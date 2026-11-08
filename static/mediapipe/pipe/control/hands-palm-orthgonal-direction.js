import {
  eulerToQuaternion,
  getCorrectedHandWorldLandmarks,
} from './common.js';

// Calculate quaternion directly from palm normal vector
const calculatePalmQuaternionFromNormal = (normalVector) => {
  if (!normalVector || normalVector.length !== 3) {
    return undefined;
  }

  const [x, y, z] = normalVector;
  
  // Normalize the vector
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  if (magnitude === 0) {
    return undefined;
  }
  
  const normalizedX = x / magnitude;
  const normalizedY = y / magnitude;
  const normalizedZ = z / magnitude;
  
  // Calculate quaternion from normalized normal vector
  // This represents the rotation from the default palm orientation (facing forward) to the current palm orientation
  
  // Default palm orientation is facing forward (positive Z direction)
  // We want to rotate from [0, 0, 1] to the current normal vector
  
  // Calculate the rotation axis and angle
  const defaultPalm = [0, 0, 1];
  const crossProduct = [
    defaultPalm[1] * normalizedZ - defaultPalm[2] * normalizedY,
    defaultPalm[2] * normalizedX - defaultPalm[0] * normalizedZ,
    defaultPalm[0] * normalizedY - defaultPalm[1] * normalizedX
  ];
  
  const dotProduct = defaultPalm[0] * normalizedX + defaultPalm[1] * normalizedY + defaultPalm[2] * normalizedZ;
  
  // Handle edge cases
  if (Math.abs(dotProduct) > 0.9999) {
    // Palm is very close to default orientation
    if (dotProduct > 0) {
      // Palm is facing forward, return identity quaternion
      return [1, 0, 0, 0];
    } else {
      // Palm is facing backward, rotate 180 degrees around X axis
      return [0, 1, 0, 0];
    }
  }
  
  // Calculate rotation angle
  const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
  
  // Normalize rotation axis
  const axisMagnitude = Math.sqrt(crossProduct[0] * crossProduct[0] + crossProduct[1] * crossProduct[1] + crossProduct[2] * crossProduct[2]);
  if (axisMagnitude === 0) {
    return [1, 0, 0, 0];
  }
  
  const normalizedAxis = [
    crossProduct[0] / axisMagnitude,
    crossProduct[1] / axisMagnitude,
    crossProduct[2] / axisMagnitude
  ];
  
  // Convert to quaternion: [cos(angle/2), sin(angle/2) * axis]
  const halfAngle = angle * 0.5;
  const cosHalfAngle = Math.cos(halfAngle);
  const sinHalfAngle = Math.sin(halfAngle);
  
  return [
    sinHalfAngle * normalizedAxis[1],               // y
    sinHalfAngle * -normalizedAxis[2],                // z
    sinHalfAngle * normalizedAxis[0],               // x
    cosHalfAngle,                                    // w
  ];
};


const generateHandPalmDirectionToAngleConverter = () => {
  // Smoothing configuration
  const SMOOTHING_FACTOR = 0.2; // 0.0 = maximum smoothing, 1.0 = no smoothing
  const MIN_CHANGE_THRESHOLD = 0.001; // Ignore changes smaller than this to reduce micro-jitter

  // Smoothing state
  let previousSmoothedAngle = null;

  // Apply exponential smoothing to a 3D vector
  const smoothVector = (currentVec, previousVec, factor, threshold) => {
    if (!previousVec) {
      return [...currentVec]; // First frame, no smoothing possible
    }

    const smoothed = [];
    for (let i = 0; i < currentVec.length; i++) {
      const diff = Math.abs(currentVec[i] - previousVec[i]);

      // Apply deadzone threshold to reduce micro-jitter
      if (diff < threshold) {
        smoothed[i] = previousVec[i]; // Keep previous value if change is too small
      } else {
        // Exponential smoothing: new = factor * current + (1 - factor) * previous
        smoothed[i] = factor * currentVec[i] + (1 - factor) * previousVec[i];
      }
    }
    return smoothed;
  };

  // Convert right or any hand: palm angle in 3D
  return (keypoints3D) => {
    if (!keypoints3D) {
      return;
    }

    // https://gamedev.stackexchange.com/questions/202242/calculate-normal-and-plane-orientation-using-4-3d-points
    // https://stackoverflow.com/questions/72003980/can-we-get-the-orientation-of-the-hand-from-mediapipes-palm-detector
    const k = keypoints3D;
    if (!k) {
      return;
    }

    // https://www.npmjs.com/package/ella-math
    const point0Vec = new Ella.Vec(k[0].x, k[0].y, k[0].z);
    const point5Vec = new Ella.Vec(k[5].x, k[5].y, k[5].z);
    const point17Vec = new Ella.Vec(k[17].x, k[17].y, k[17].z);
    const normalVec = point17Vec.sub(point0Vec).cross(point5Vec.sub(point17Vec));

    const angle = normalVec.toArray();

    // Apply smoothing
    const smoothedAngle = smoothVector(
      angle,
      previousSmoothedAngle,
      SMOOTHING_FACTOR,
      MIN_CHANGE_THRESHOLD
    );
    previousSmoothedAngle = smoothedAngle;

    return smoothedAngle;
  };
};

export const generateHandsToAngleConverter = () => {
  const leftHandPalmToAngle = generateHandPalmDirectionToAngleConverter();
  const rightHandPalmToAngle = generateHandPalmDirectionToAngleConverter();

  // Convert right or any hand: palm angle in 3D
  return (hands) => {
    if (!hands) {
      return;
    }

    const [keypoints3DLeft, keypoints3DRight] =
      getCorrectedHandWorldLandmarks(hands);


    const eulerLeft = leftHandPalmToAngle(keypoints3DLeft);
    const eulerRight = rightHandPalmToAngle(keypoints3DRight);

    return {
      palmOrthogonalEulerLeft: eulerLeft,
      palmOrthogonalEulerRight: eulerRight,
      // doesn't work for some reason
      palmOrthogonalQuaternionLeft: eulerLeft ? eulerToQuaternion(eulerLeft) : undefined,
      palmOrthogonalQuaternionRight: eulerRight ? eulerToQuaternion(eulerRight) : undefined,
      // Direct quaternion calculation from palm normal (no Euler conversion)
      palmOrthogonalQuaternionDirectLeft: eulerLeft ? calculatePalmQuaternionFromNormal(eulerLeft) : undefined,
      palmOrthogonalQuaternionDirectRight: eulerRight ? calculatePalmQuaternionFromNormal(eulerRight) : undefined,
    };
  };
};

