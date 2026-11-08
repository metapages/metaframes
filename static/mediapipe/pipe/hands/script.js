import {
  FilesetResolver,
  HandLandmarker,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';

import { generateHandsControl } from '../control/hands.js';

const searchParams = new URLSearchParams(globalThis.location.search);
const emitRawHandData = searchParams.get("emitRawHandData") === "true" || searchParams.get("emitRawHandData") === "1";

let handLandmarker = undefined;
const runningMode = "VIDEO";
let webcamRunning = false;

const calculatehandsControl = generateHandsControl();

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
await createHandLandmarker();

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

let lastVideoTime = -1;
let results = undefined;
// console.log(video);
function predictWebcam() {
  canvasElement.style.width = video.videoWidth;
  canvasElement.style.height = video.videoHeight;
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  const startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = handLandmarker.detectForVideo(video, startTimeMs);
    if (
      results?.landmarks?.length > 0 || results?.worldLandmarks?.length > 0 ||
      results?.handednesses?.length > 0
    ) {
      const handsControl = calculatehandsControl(results);

      // save emitting all that unneeded data if we just want the derived control data
      if (emitRawHandData) {
        metaframe?.setOutputs({ hands: results, ...handsControl, timestamp: startTimeMs });
      } else {
        metaframe?.setOutputs({ ...handsControl, timestamp: startTimeMs });
      }
    }
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      // Create a copy of the landmarks with transformed x-coordinates
      const transformedLandmarks = landmarks.map((landmark) => ({
        x: 1 - landmark.x,
        y: landmark.y,
        z: landmark.z,
      }));

      // Draw the transformed connectors and landmarks
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
