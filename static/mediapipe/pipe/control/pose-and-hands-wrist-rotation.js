import { TAU, eulerToQuaternion, debugEulerQuaternionConversion } from "./common.js";

/**
 * Calculate pose control based on wrist-to-wrist orientation
 * Generates a quaternion representing the angle from left wrist to right wrist
 */

export const getWristsRotationQuaternion = (poseResults) => {
  if (!poseResults?.worldLandmarks?.[0]) {
    return {};
  }

  const poseWorldLandmarks = poseResults.worldLandmarks[0];
  
  // Get wrist landmarks (MediaPipe pose landmarks)
  const leftWrist = poseWorldLandmarks[15];  // Left wrist
  const rightWrist = poseWorldLandmarks[16]; // Right wrist
  
  if (!leftWrist || !rightWrist) {
    return undefined;
  }

  // Calculate the vector from left wrist to right wrist
  const wristVector = {
    x: rightWrist.x - leftWrist.x,
    y: rightWrist.y - leftWrist.y,
    z: rightWrist.z - leftWrist.z
  };

  // Calculate the magnitude of the wrist vector
  const wristDistance = Math.sqrt(
    wristVector.x * wristVector.x + 
    wristVector.y * wristVector.y + 
    wristVector.z * wristVector.z
  );

  if (wristDistance === 0) {
    return undefined;
  }

  // Normalize the wrist vector
  const normalizedWristVector = {
    x: wristVector.x / wristDistance,
    y: wristVector.y / wristDistance,
    z: wristVector.z / wristDistance
  };

  // Calculate rotation angles using proper axis order
  // Roll (X-axis): rotation around the forward direction
  const roll = Math.atan2(normalizedWristVector.y, normalizedWristVector.x);
  
  // Pitch (Y-axis): up/down tilt - use atan2 for better stability
  const pitch = Math.atan2(-normalizedWristVector.y, Math.sqrt(normalizedWristVector.x * normalizedWristVector.x + normalizedWristVector.z * normalizedWristVector.z));
  
  // Yaw (Z-axis): left/right rotation - use atan2 for better stability
  const yaw = Math.atan2(normalizedWristVector.x, normalizedWristVector.z);

  // Normalize angles to prevent jumps - use a more stable normalization
  const normalizedRoll = ((roll + Math.PI) % TAU) - Math.PI;
  const normalizedPitch = ((pitch + Math.PI) % TAU) - Math.PI;
  const normalizedYaw = ((yaw + Math.PI) % TAU) - Math.PI;

  // Debug: Log the raw angles and normalized angles
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    console.log("Raw angles:", { roll, pitch, yaw });
    console.log("Normalized angles:", { normalizedRoll, normalizedPitch, normalizedYaw });
    console.log("Wrist vector:", normalizedWristVector);
    
    // Additional debug info
    console.log("Vector magnitude in XZ plane:", Math.sqrt(normalizedWristVector.x * normalizedWristVector.x + normalizedWristVector.z * normalizedWristVector.z));
    console.log("Vector magnitude in XY plane:", Math.sqrt(normalizedWristVector.x * normalizedWristVector.x + normalizedWristVector.y * normalizedWristVector.y));
  }

  // Use the eulerToQuaternion function with [roll, pitch, yaw] order
  const quaternionArray = eulerToQuaternion([normalizedRoll, normalizedPitch, normalizedYaw]);

  // Debug: Test round-trip conversion
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    const debug = debugEulerQuaternionConversion([normalizedRoll, normalizedPitch, normalizedYaw]);
    console.log("Quaternion conversion debug:", debug);
  }

  // Convert array to object format
  const quaternion = {
    w: quaternionArray[0],
    x: quaternionArray[1], 
    y: quaternionArray[2],
    z: quaternionArray[3]
  };

  return {
    poseWristQuaternion: quaternion,
    poseWristRoll: normalizedRoll,
    poseWristPitch: normalizedPitch,
    poseWristYaw: normalizedYaw,
    poseWristDistance: wristDistance
  };
};

