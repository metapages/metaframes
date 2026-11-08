import { TAU } from "./common.js";
import { getWristsRotationQuaternion } from "./pose-and-hands-wrist-rotation.js";

/**
 * Calculate pose control based on wrist-to-wrist orientation
 * Generates a quaternion representing the angle from left wrist to right wrist
 */

export const generatePoseControl = () => {
  return (poseResults) => {
    if (!poseResults?.worldLandmarks?.[0]) {
      return undefined;
    }

    const poseWristAngle = getWristsRotationQuaternion(poseResults);


    return {
      ...poseWristAngle,
    };
  };
};
