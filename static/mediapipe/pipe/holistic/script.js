import {
  FilesetResolver,
  HolisticLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";

let holisticLandmarker = undefined;
const runningMode = "VIDEO";
let webcamRunning = false;

const createHolisticLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm",
  );
  holisticLandmarker = await HolisticLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        `https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task`,
      delegate: "GPU",
    },
    runningMode: runningMode,
  });
};
await createHolisticLandmarker();

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
await holisticLandmarker?.setOptions({ runningMode: "VIDEO" });

let lastVideoTime = -1;
let results = undefined;

function predictWebcam() {
  canvasElement.style.width = video.videoWidth;
  canvasElement.style.height = video.videoHeight;
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  const startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = holisticLandmarker.detectForVideo(video, startTimeMs);
    if (
      results?.poseLandmarks?.length > 0 ||
      results?.leftHandLandmarks?.length > 0 ||
      results?.rightHandLandmarks?.length > 0 ||
      results?.faceLandmarks?.length > 0
    ) {
      metaframe?.setOutput({ ...results, timestamp: startTimeMs });
    }
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Draw pose landmarks
  if (results?.poseLandmarks) {
    for (const landmarks of results.poseLandmarks) {
      const transformedLandmarks = landmarks.map((landmark) => ({
        x: 1 - landmark.x,
        y: landmark.y,
        z: landmark.z,
      }));

      drawConnectors(canvasCtx, transformedLandmarks, POSE_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5,
      });
      drawLandmarks(canvasCtx, transformedLandmarks, {
        color: "#FF0000",
        lineWidth: 2,
      });
    }
  }

  // Draw left hand landmarks
  if (results?.leftHandLandmarks) {
    for (const landmarks of results.leftHandLandmarks) {
      const transformedLandmarks = landmarks.map((landmark) => ({
        x: 1 - landmark.x,
        y: landmark.y,
        z: landmark.z,
      }));

      drawConnectors(canvasCtx, transformedLandmarks, HAND_CONNECTIONS, {
        color: "#0000FF",
        lineWidth: 3,
      });
      drawLandmarks(canvasCtx, transformedLandmarks, {
        color: "#FF00FF",
        lineWidth: 2,
      });
    }
  }

  // Draw right hand landmarks
  if (results?.rightHandLandmarks) {
    for (const landmarks of results.rightHandLandmarks) {
      const transformedLandmarks = landmarks.map((landmark) => ({
        x: 1 - landmark.x,
        y: landmark.y,
        z: landmark.z,
      }));

      drawConnectors(canvasCtx, transformedLandmarks, HAND_CONNECTIONS, {
        color: "#FF8800",
        lineWidth: 3,
      });
      drawLandmarks(canvasCtx, transformedLandmarks, {
        color: "#FFFF00",
        lineWidth: 2,
      });
    }
  }

  // Draw face landmarks
  if (results?.faceLandmarks) {
    for (const landmarks of results.faceLandmarks) {
      const transformedLandmarks = landmarks.map((landmark) => ({
        x: 1 - landmark.x,
        y: landmark.y,
        z: landmark.z,
      }));

      drawConnectors(canvasCtx, transformedLandmarks, FACEMESH_TESSELATION, {
        color: "#C0C0C070",
        lineWidth: 1,
      });
      drawConnectors(canvasCtx, transformedLandmarks, FACEMESH_RIGHT_EYE, {
        color: "#FF3030",
        lineWidth: 1,
      });
      drawConnectors(canvasCtx, transformedLandmarks, FACEMESH_LEFT_EYE, {
        color: "#30FF30",
        lineWidth: 1,
      });
      drawConnectors(canvasCtx, transformedLandmarks, FACEMESH_FACE_OVAL, {
        color: "#E0E0E0",
        lineWidth: 1,
      });
      drawConnectors(canvasCtx, transformedLandmarks, FACEMESH_LIPS, {
        color: "#E0E0E0",
        lineWidth: 1,
      });
    }
  }

  canvasCtx.restore();

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    globalThis.requestAnimationFrame(predictWebcam);
  }
}
