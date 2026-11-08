import { TAU } from './common.js';

/**
 * Calculate wrist rotation angle based on hand orientation
 * Focuses on pronation/supination (rotation around forearm axis) while filtering out side-to-side motion
 * Includes angle unwrapping to prevent flipping for continuous motion
 */

export const calculateWristRotation = (keypoints3D) => {
  if (!keypoints3D) {
    return;
  }
  const wrist = keypoints3D[0];           // Wrist
  const indexBase = keypoints3D[5];       // Index finger base
  const pinkyBase = keypoints3D[17];      // Pinky base
  
  // Calculate the forearm direction vector (wrist to middle of knuckles)
  const forearmVector = {
    x: (indexBase.x + pinkyBase.x) / 2 - wrist.x,
    y: (indexBase.y + pinkyBase.y) / 2 - wrist.y,
    z: (indexBase.z + pinkyBase.z) / 2 - wrist.z
  };
  
  // Calculate the knuckle line vector (index to pinky)
  const knuckleVector = {
    x: pinkyBase.x - indexBase.x,
    y: pinkyBase.y - indexBase.y,
    z: pinkyBase.z - indexBase.z
  };
  
  // Calculate the palm normal using cross product
  // This gives us the direction the palm is facing
  const palmNormal = {
    x: forearmVector.y * knuckleVector.z - forearmVector.z * knuckleVector.y,
    y: forearmVector.z * knuckleVector.x - forearmVector.x * knuckleVector.z,
    z: forearmVector.x * knuckleVector.y - forearmVector.y * knuckleVector.x
  };
  
  // Normalize the palm normal
  const normalLength = Math.sqrt(palmNormal.x * palmNormal.x + palmNormal.y * palmNormal.y + palmNormal.z * palmNormal.z);
  if (normalLength === 0) {
    return 0;
  }
  
  const normalizedPalmNormal = {
    x: palmNormal.x / normalLength,
    y: palmNormal.y / normalLength,
    z: palmNormal.z / normalLength
  };
  
  // Calculate the raw wrist rotation angle
  const rawWristRotation = Math.atan2(normalizedPalmNormal.x, normalizedPalmNormal.z);
  
  // Store previous angle for unwrapping (static variable)
  if (!calculateWristRotation.previousAngle) {
    calculateWristRotation.previousAngle = rawWristRotation;
  }
  
  // Unwrap the angle to prevent flipping
  let unwrappedAngle = rawWristRotation;
  const angleDiff = rawWristRotation - calculateWristRotation.previousAngle;
  
  // If the angle difference is greater than π, we've crossed the ±π boundary
  if (angleDiff > Math.PI) {
    unwrappedAngle = rawWristRotation - TAU;
  } else if (angleDiff < -Math.PI) {
    unwrappedAngle = rawWristRotation + TAU;
  }
  
  // Update the previous angle for next frame
  calculateWristRotation.previousAngle = unwrappedAngle;
  
  return unwrappedAngle;
};
