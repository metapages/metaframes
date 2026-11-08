import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
import { generateHandsControl } from '../control/hands.js';
import { generatePoseControl } from '../control/pose-and-hands.js';

let handLandmarker = undefined;
let poseLandmarker = undefined;
const runningMode = "VIDEO";
let webcamRunning = false;

const calculateHandsControl = generateHandsControl();
const calculatePoseControl = generatePoseControl();
const searchParams = new URLSearchParams(globalThis.location.search);
const emitRawHandData = searchParams.get("emitRawHandData") === "true" || searchParams.get("emitRawHandData") === "1";
const emitRawPoseData = searchParams.get("emitRawPoseData") === "true" || searchParams.get("emitRawPoseData") === "1";

const createHandLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm",
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU",
    },
    runningMode: runningMode,
    numHands: 2,
  });
};

const createPoseLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm",
  );
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
      delegate: "GPU",
    },
    runningMode: runningMode,
    numPoses: 1,
  });
};

await Promise.all([createHandLandmarker(), createPoseLandmarker()]);

const video = document.getElementById("webcam");
const canvasElement = document.getElementById(
  "output-canvas",
);

const canvasCtx = canvasElement.getContext("2d");

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  throw new Error(
    "Browser API navigator.mediaDevices.getUserMedia not available",
  );
}

function enableCam(_) {
  const constraints = {
    video: true,
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
  webcamRunning = true;
}

enableCam();
await handLandmarker?.setOptions({ runningMode: "VIDEO" });
await poseLandmarker?.setOptions({ runningMode: "VIDEO" });

// Jitter control constants
const JITTER_CONTROL = {
  // Smoothing factor for pose landmarks (0 = no smoothing, 1 = maximum smoothing)
  POSE_SMOOTHING_FACTOR: 0.7,
  // Maximum allowed movement per frame before gradual transition kicks in
  MAX_POSE_MOVEMENT_THRESHOLD: 0.05,
  // How quickly to adapt to large pose changes (0 = never, 1 = immediately)
  LARGE_MOVEMENT_ADAPTATION_RATE: 0.2,
  // Minimum confidence required for pose landmarks to be used
  MIN_POSE_CONFIDENCE: 0.5,
  // How long to keep using last known good pose (in milliseconds)
  POSE_MEMORY_DURATION: 1000,
};

// State for jitter control
let smoothedPoseLandmarks = null;
let smoothedPoseWorldLandmarks = null;
let lastGoodPoseTime = 0;
let lastValidPose = null;
let lastValidPoseWorld = null;

function calculateDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1.x - point2.x, 2) +
      Math.pow(point1.y - point2.y, 2) +
      Math.pow(point1.z - point2.z, 2),
  );
}

function smoothLandmarks(
  currentLandmarks,
  previousLandmarks,
  smoothingFactor,
  movementThreshold,
  adaptationRate,
) {
  if (!previousLandmarks) return currentLandmarks;

  return currentLandmarks.map((landmark, index) => {
    const prevLandmark = previousLandmarks[index];
    if (!prevLandmark) return landmark;

    // Calculate movement distance
    const distance = calculateDistance(landmark, prevLandmark);

    // If movement is small, apply strong smoothing
    if (distance < movementThreshold) {
      return {
        x: prevLandmark.x +
          (landmark.x - prevLandmark.x) * (1 - smoothingFactor),
        y: prevLandmark.y +
          (landmark.y - prevLandmark.y) * (1 - smoothingFactor),
        z: prevLandmark.z +
          (landmark.z - prevLandmark.z) * (1 - smoothingFactor),
      };
    } else {
      // For large movements, use gradual adaptation
      const adaptedSmoothingFactor = smoothingFactor * (1 - adaptationRate);
      return {
        x: prevLandmark.x +
          (landmark.x - prevLandmark.x) * (1 - adaptedSmoothingFactor),
        y: prevLandmark.y +
          (landmark.y - prevLandmark.y) * (1 - adaptedSmoothingFactor),
        z: prevLandmark.z +
          (landmark.z - prevLandmark.z) * (1 - adaptedSmoothingFactor),
      };
    }
  });
}

function getStabilizedPoseLandmarks(currentPose, currentPoseWorld, timestamp) {
  let usePose = currentPose;
  let usePoseWorld = currentPoseWorld;

  // Check if current pose is reliable
  const isPoseReliable = currentPose && currentPose.length > 0;

  if (isPoseReliable) {
    // Update last good pose
    lastValidPose = currentPose;
    lastValidPoseWorld = currentPoseWorld;
    lastGoodPoseTime = timestamp;

    // Apply smoothing
    if (smoothedPoseLandmarks) {
      smoothedPoseLandmarks = smoothLandmarks(
        currentPose,
        smoothedPoseLandmarks,
        JITTER_CONTROL.POSE_SMOOTHING_FACTOR,
        JITTER_CONTROL.MAX_POSE_MOVEMENT_THRESHOLD,
        JITTER_CONTROL.LARGE_MOVEMENT_ADAPTATION_RATE,
      );
    } else {
      smoothedPoseLandmarks = [...currentPose];
    }

    if (currentPoseWorld && currentPoseWorld.length > 0) {
      if (smoothedPoseWorldLandmarks) {
        smoothedPoseWorldLandmarks = smoothLandmarks(
          currentPoseWorld,
          smoothedPoseWorldLandmarks,
          JITTER_CONTROL.POSE_SMOOTHING_FACTOR,
          JITTER_CONTROL.MAX_POSE_MOVEMENT_THRESHOLD,
          JITTER_CONTROL.LARGE_MOVEMENT_ADAPTATION_RATE,
        );
      } else {
        smoothedPoseWorldLandmarks = [...currentPoseWorld];
      }
    }

    usePose = smoothedPoseLandmarks;
    usePoseWorld = smoothedPoseWorldLandmarks;
  } else {
    // No current pose, check if we can use cached pose
    const timeSinceLastGoodPose = timestamp - lastGoodPoseTime;

    if (
      timeSinceLastGoodPose < JITTER_CONTROL.POSE_MEMORY_DURATION &&
      lastValidPose
    ) {
      // Use last known good pose
      usePose = smoothedPoseLandmarks || lastValidPose;
      usePoseWorld = smoothedPoseWorldLandmarks || lastValidPoseWorld;
    } else {
      // No pose available
      usePose = null;
      usePoseWorld = null;
    }
  }

  return {
    landmarks: usePose ? [usePose] : null,
    worldLandmarks: usePoseWorld ? [usePoseWorld] : null,
  };
}

function transformHandLandmarksWithPose(
  handLandmarks,
  poseLandmarks,
  handednesses,
) {
  if (!poseLandmarks || poseLandmarks.length === 0) {
    return handLandmarks;
  }

  const pose = poseLandmarks[0];

  // Get wrist landmarks for transformation reference
  const leftWrist = pose[15]; // Left wrist
  const rightWrist = pose[16]; // Right wrist

  // Calculate wrist distance for scaling
  const wristDistance = Math.abs(leftWrist.x - rightWrist.x);

  // Transform hand landmarks based on pose wrist positions
  return handLandmarks.map((handSet, handIndex) => {
    // Determine which wrist to use based on handedness information
    let targetWrist = leftWrist; // default to left

    if (
      handednesses && handednesses[handIndex] &&
      handednesses[handIndex].length > 0
    ) {
      // Use MediaPipe's handedness detection
      const handedness = handednesses[handIndex][0].categoryName;
      // MediaPipe reports handedness from the person's perspective, but the video is mirrored
      // So "Left" hand should go to the left wrist landmark (pose[15])
      targetWrist = handedness === "Left" ? leftWrist : rightWrist;
    } else {
      // Fallback: determine by proximity to pose wrists
      const handWrist = handSet[0];
      const distToLeft = Math.abs(handWrist.x - leftWrist.x) +
        Math.abs(handWrist.y - leftWrist.y);
      const distToRight = Math.abs(handWrist.x - rightWrist.x) +
        Math.abs(handWrist.y - rightWrist.y);
      targetWrist = distToLeft < distToRight ? leftWrist : rightWrist;
    }

    // Get the hand wrist landmark (index 0) as reference point
    const handWrist = handSet[0];

    // Calculate the scale factor based on wrist distance
    // Using a larger scale factor (1.2) to make hands more visible
    const scaleFactor = wristDistance * 1.2;

    return handSet.map((landmark) => {
      // Calculate the offset from hand wrist
      const offsetX = landmark.x - handWrist.x;
      const offsetY = landmark.y - handWrist.y;

      // Apply scaling and position relative to pose wrist
      return {
        x: targetWrist.x + offsetX * scaleFactor,
        y: targetWrist.y + offsetY * scaleFactor,
        z: landmark.z * scaleFactor, // Scale z coordinate as well
      };
    });
  });
}

function transformHandWorldLandmarksWithPose(
  handWorldLandmarks,
  poseWorldLandmarks,
  handednesses,
) {
  if (!poseWorldLandmarks || poseWorldLandmarks.length === 0) {
    return handWorldLandmarks;
  }

  const poseWorld = poseWorldLandmarks[0];

  // Get wrist world landmarks for transformation reference
  const leftWristWorld = poseWorld[15]; // Left wrist
  const rightWristWorld = poseWorld[16]; // Right wrist

  // Calculate wrist distance for scaling in world space
  const wristDistanceWorld = Math.sqrt(
    Math.pow(leftWristWorld.x - rightWristWorld.x, 2) +
      Math.pow(leftWristWorld.y - rightWristWorld.y, 2) +
      Math.pow(leftWristWorld.z - rightWristWorld.z, 2),
  );

  // Transform hand world landmarks based on pose world wrist positions
  return handWorldLandmarks.map((handWorldSet, handIndex) => {
    // Determine which wrist to use based on handedness information
    let targetWristWorld = leftWristWorld; // default to left

    if (
      handednesses && handednesses[handIndex] &&
      handednesses[handIndex].length > 0
    ) {
      // Use MediaPipe's handedness detection
      const handedness = handednesses[handIndex][0].categoryName;
      // MediaPipe reports handedness from the person's perspective, but the video is mirrored
      // So "Left" hand should go to the left wrist landmark (pose[15])
      targetWristWorld = handedness === "Left"
        ? leftWristWorld
        : rightWristWorld;
    } else {
      // Fallback: determine by proximity to pose wrists in world space
      const handWristWorld = handWorldSet[0];
      const distToLeftWorld = Math.sqrt(
        Math.pow(handWristWorld.x - leftWristWorld.x, 2) +
          Math.pow(handWristWorld.y - leftWristWorld.y, 2) +
          Math.pow(handWristWorld.z - leftWristWorld.z, 2),
      );
      const distToRightWorld = Math.sqrt(
        Math.pow(handWristWorld.x - rightWristWorld.x, 2) +
          Math.pow(handWristWorld.y - rightWristWorld.y, 2) +
          Math.pow(handWristWorld.z - rightWristWorld.z, 2),
      );
      targetWristWorld = distToLeftWorld < distToRightWorld
        ? leftWristWorld
        : rightWristWorld;
    }

    // Get the hand wrist world landmark (index 0) as reference point
    const handWristWorld = handWorldSet[0];

    // Calculate the scale factor based on wrist distance in world space
    // Using a scale factor to align hand size with pose proportions
    const scaleFactor = wristDistanceWorld * 0.8;

    return handWorldSet.map((landmark) => {
      // Calculate the offset from hand wrist in world space
      const offsetX = landmark.x - handWristWorld.x;
      const offsetY = landmark.y - handWristWorld.y;
      const offsetZ = landmark.z - handWristWorld.z;

      // Apply scaling and position relative to pose wrist in world space
      return {
        x: targetWristWorld.x + offsetX * scaleFactor,
        y: targetWristWorld.y + offsetY * scaleFactor,
        z: targetWristWorld.z + offsetZ * scaleFactor,
      };
    });
  });
}

let lastVideoTime = -1;
let handResults = undefined;
let poseResults = undefined;
let stabilizedPoseResults = undefined;
let stabilizedPose = undefined;

async function predictWebcam() {
  canvasElement.style.width = video.videoWidth;
  canvasElement.style.height = video.videoHeight;
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  const startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;

    // Run both detections concurrently
    const [handDetection, poseDetection] = await Promise.all([
      handLandmarker.detectForVideo(video, startTimeMs),
      poseLandmarker.detectForVideo(video, startTimeMs),
    ]);

    handResults = handDetection;
    poseResults = poseDetection;
  }

  // Get stabilized pose landmarks (always run this for smoothing)
  stabilizedPose = getStabilizedPoseLandmarks(
    poseResults?.landmarks?.[0],
    poseResults?.worldLandmarks?.[0],
    startTimeMs,
  );

  // Create stabilized pose results
  stabilizedPoseResults = {
    ...poseResults,
    landmarks: stabilizedPose.landmarks,
    worldLandmarks: stabilizedPose.worldLandmarks,
  };

  // Transform hand landmarks using stabilized pose data
  let transformedHandResults = handResults;
  if (
    handResults?.landmarks?.length > 0 && stabilizedPose.landmarks
  ) {
    transformedHandResults = {
      ...handResults,
      landmarks: transformHandLandmarksWithPose(
        handResults.landmarks,
        stabilizedPose.landmarks,
        handResults.handednesses,
      ),
      worldLandmarks: handResults.worldLandmarks?.length > 0 &&
          stabilizedPose.worldLandmarks
        ? transformHandWorldLandmarksWithPose(
          handResults.worldLandmarks,
          stabilizedPose.worldLandmarks,
          handResults.handednesses,
        )
        : handResults.worldLandmarks,
      handednesses: handResults.handednesses,
    };
  }

  const poseControl = calculatePoseControl(stabilizedPoseResults);
  const handsControl = calculateHandsControl(handResults);

  // Output combined results
  const combinedResults = {
    ...handsControl,
    ...poseControl,
    hands: (emitRawHandData ? handResults : undefined),
    handsTransformedWithPose: (emitRawHandData ? transformedHandResults : undefined),
    pose: (emitRawPoseData ? stabilizedPoseResults : undefined),
    timestamp: startTimeMs,
  };
  // console.log(combinedResults);
  metaframe?.setOutputs(combinedResults);

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  // Draw pose landmarks first (as background)
  if (stabilizedPoseResults?.landmarks) {
    for (const landmarks of stabilizedPoseResults.landmarks) {
      const transformedLandmarks = landmarks.map((landmark) => ({
        x: landmark.x,
        y: landmark.y,
        z: landmark.z,
      }));

      drawConnectors(canvasCtx, transformedLandmarks, POSE_CONNECTIONS, {
        color: "#0000FF",
        lineWidth: 2,
      });
      drawLandmarks(canvasCtx, transformedLandmarks, {
        color: "#0000FF",
        lineWidth: 1,
      });
    }
  }

  // Draw transformed hand landmarks on top
  if (handResults?.landmarks && stabilizedPose.landmarks) {
    const transformedHandLandmarks = transformHandLandmarksWithPose(
      handResults.landmarks,
      stabilizedPose.landmarks,
      handResults.handednesses,
    );

    for (const landmarks of transformedHandLandmarks) {
      const mirroredLandmarks = landmarks.map((landmark) => ({
        x: landmark.x,
        y: landmark.y,
        z: landmark.z,
      }));

      drawConnectors(canvasCtx, mirroredLandmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5,
      });
      drawLandmarks(canvasCtx, mirroredLandmarks, {
        color: "#FF0000",
        lineWidth: 2,
      });
    }
  } else if (handResults?.landmarks) {
    // Fallback to regular hand landmarks if no pose detected
    for (const landmarks of handResults.landmarks) {
      const transformedLandmarks = landmarks.map((landmark) => ({
        x: landmark.x,
        y: landmark.y,
        z: landmark.z,
      }));

      drawConnectors(canvasCtx, transformedLandmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5,
      });
      drawLandmarks(canvasCtx, transformedLandmarks, {
        color: "#FF0000",
        lineWidth: 2,
      });
    }
  }

  canvasCtx.restore();

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    globalThis.requestAnimationFrame(predictWebcam);
  }
}
