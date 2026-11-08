


export const TAU = Math.PI * 2;

const EmptyArray = [];
export const getCorrectedHandWorldLandmarks = (hands) => {
  const handsCount = hands?.handedness?.length;
  if (!handsCount) {
    return EmptyArray;
  }
  const rightHandednessIndex = hands?.handedness?.findIndex(
    (e) => e?.[0]?.categoryName === "Right",
  );
  const leftHandednessIndex = hands?.handedness?.findIndex(
    (e) => e?.[0]?.categoryName === "Left",
  );
  const keypoints3DRight = hands?.worldLandmarks?.[rightHandednessIndex];
  const keypoints3DLeft = hands?.worldLandmarks?.[leftHandednessIndex];
  if (!keypoints3DRight && !keypoints3DLeft) {
    return EmptyArray;
  }
  return [keypoints3DLeft, keypoints3DRight];
};

/**
 * Calculate angle between 3 points in 3D space.
 * Note: assumes we want 1 vector to run from coord1 -> coord2, and the other
 * from coord3 -> coord2.
 */
export const angleBetween3DCoords = (coord1, coord2, coord3) => {
  // Calculate vector between points 1 and 2
  const v1 = {
    x: coord1.x - coord2.x,
    y: coord1.y - coord2.y,
    z: coord1.z - coord2.z,
  };

  // Calculate vector between points 2 and 3
  const v2 = {
    x: coord3.x - coord2.x,
    y: coord3.y - coord2.y,
    z: coord3.z - coord2.z,
  };

  // The dot product of vectors v1 & v2 is a function of the cosine of the
  // angle between them (it's scaled by the product of their magnitudes).

  // Normalize v1
  const v1mag = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const v1norm = {
    x: v1.x / v1mag,
    y: v1.y / v1mag,
    z: v1.z / v1mag,
  };

  // Normalize v2
  const v2mag = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
  const v2norm = {
    x: v2.x / v2mag,
    y: v2.y / v2mag,
    z: v2.z / v2mag,
  };

  // Calculate the dot products of vectors v1 and v2
  const dotProducts = v1norm.x * v2norm.x + v1norm.y * v2norm.y +
    v1norm.z * v2norm.z;

  // Extract the angle from the dot products
  const angle = Math.acos(dotProducts);

  return angle;
  // Round result to 3 decimal points and return
  // return Math.round(angle * 1000) / 1000;
};

/**
 * Normalizes an angle to the range [0, 2π)
 * @param {number} angle - Angle in radians
 * @returns {number} Normalized angle
 */
export function normalizeAngle(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

/**
 * Calculates the shortest angular distance between two angles on a circle
 * @param {number} angle1 - First angle in radians
 * @param {number} angle2 - Second angle in radians
 * @returns {number} Shortest distance between angles
 */
export function angularDistance(angle1, angle2) {
  const diff = Math.abs(angle1 - angle2);
  return Math.min(diff, TAU - diff);
}

/**
 * Checks if an angle is within the arc between two threshold angles
 * @param {number} angle - Angle to check (should already be normalized to [0, 2π))
 * @param {number} lowerThreshold - Lower threshold angle (should already be normalized to [0, 2π))
 * @param {number} upperThreshold - Upper threshold angle (should already be normalized to [0, 2π))
 * @returns {boolean} True if angle is between thresholds
 */
export function isAngleBetweenThresholds(
  angle,
  lowerThreshold,
  upperThreshold,
) {
  // Ensure all angles are normalized for consistent comparison
  const normAngle = normalizeAngle(angle);
  const normLower = normalizeAngle(lowerThreshold);
  const normUpper = normalizeAngle(upperThreshold);

  if (normLower <= normUpper) {
    // Simple case: range doesn't cross 0
    return normAngle >= normLower && normAngle <= normUpper;
  } else {
    // Complex case: range crosses 0 (e.g., from 5π/3 to π/3)
    return normAngle >= normLower || normAngle <= normUpper;
  }
}

/**
 * Circular clamping function that keeps values between thresholds unchanged,
 * and clamps values outside the threshold range to the nearest threshold.
 *
 * @param {number} angle - Input angle in radians
 * @param {number} lowerThreshold - Lower threshold angle in radians
 * @param {number} upperThreshold - Upper threshold angle in radians
 * @returns {number} Clamped angle in radians
 */
export function circularClamp(angle, lowerThreshold, upperThreshold) {
  // Normalize all angles to [0, 2π) for consistent comparison
  const normAngle = normalizeAngle(angle);
  const normLower = normalizeAngle(lowerThreshold);
  const normUpper = normalizeAngle(upperThreshold);

  // Check if angle is in the allowed zone (between thresholds)
  if (isAngleBetweenThresholds(normAngle, normLower, normUpper)) {
    // Angle is in the allowed zone, return the normalized angle
    return normAngle;
  }

  // Angle is outside the allowed zone, clamp to nearest threshold
  const distToLower = angularDistance(normAngle, normLower);
  const distToUpper = angularDistance(normAngle, normUpper);

  return distToLower <= distToUpper ? normLower : normUpper;
}

/**
 * Normalizes a clamped angle to a value between 0 and 1 based on its position
 * within the allowed zone (the area between the thresholds).
 *
 * @param {number} clampedAngle - The angle after circular clamping
 * @param {number} lowerThreshold - Lower threshold angle in radians
 * @param {number} upperThreshold - Upper threshold angle in radians
 * @returns {number} Normalized value between 0 and 1
 */
export function normalizeClampedAngle(
  clampedAngle,
  lowerThreshold,
  upperThreshold,
) {
  // Ensure all angles are normalized for consistent calculation
  const normClamped = normalizeAngle(clampedAngle);
  const normLower = normalizeAngle(lowerThreshold);
  const normUpper = normalizeAngle(upperThreshold);

  // Calculate the size of the allowed zone (arc between thresholds)
  let allowedZoneSize;
  if (normLower <= normUpper) {
    // Simple case: range doesn't cross 0
    allowedZoneSize = normUpper - normLower;
  } else {
    // Complex case: range crosses 0 (e.g., from 5π/3 to π/3)
    allowedZoneSize = (TAU - normLower) + normUpper;
  }

  // Handle edge case of zero-sized zone
  if (allowedZoneSize === 0) {
    return 0;
  }

  // Calculate position within the allowed zone
  let positionInAllowedZone;

  if (normLower <= normUpper) {
    // Simple case: allowed zone doesn't cross 0
    positionInAllowedZone = normClamped - normLower;
    // Ensure position is non-negative
    if (positionInAllowedZone < 0) {
      positionInAllowedZone += TAU;
    }
  } else {
    // Complex case: allowed zone crosses 0
    if (normClamped >= normLower) {
      // We're in the first part of the allowed zone (before crossing 0)
      positionInAllowedZone = normClamped - normLower;
    } else if (normClamped <= normUpper) {
      // We're in the second part of the allowed zone (after crossing 0)
      positionInAllowedZone = (TAU - normLower) + normClamped;
    } else {
      // This shouldn't happen if the angle was properly clamped
      positionInAllowedZone = 0;
    }
  }

  // Normalize to [0, 1] and clamp to ensure we stay in range
  return Math.max(0, Math.min(1, positionInAllowedZone / allowedZoneSize));
}

/**
 * Clamps an angle to the nearest threshold and returns its normalized position (0-1) within the allowed zone
 *
 * @param {number} angle - Input angle in radians
 * @param {number} lowerThreshold - Lower threshold angle in radians
 * @param {number} upperThreshold - Upper threshold angle in radians
 * @returns {number} Normalized position value between 0 and 1
 */
export function circularClampAndNormalize(
  angle,
  lowerThreshold,
  upperThreshold,
) {
  const clamped = circularClamp(angle, lowerThreshold, upperThreshold);
  return normalizeClampedAngle(clamped, lowerThreshold, upperThreshold);
}

/**
 * Clamps an angle to the nearest threshold and returns the clamped angle normalized to [0, 2π)
 *
 * @param {number} angle - Input angle in radians
 * @param {number} lowerThreshold - Lower threshold angle in radians
 * @param {number} upperThreshold - Upper threshold angle in radians
 * @returns {number} Clamped angle normalized to the range [0, 2π)
 */
export function circularClampAndNormalizeAngle(
  angle,
  lowerThreshold,
  upperThreshold,
) {
  const clamped = circularClamp(angle, lowerThreshold, upperThreshold);
  return normalizeAngle(clamped);
}

/**
 * Converts Euler angles (in radians) to a quaternion using ZYX order (roll, pitch, yaw)
 * This is the most common order used in aerospace and computer graphics
 * @param {Array} euler - Array of [roll, pitch, yaw] in radians
 * @returns {Array} Quaternion as [w, x, y, z] (standard quaternion format)
 */
/**
 * Converts Euler angles (in radians) to a quaternion using XYZ order
 * @param {Array} euler - Array of [x, y, z] rotations in radians
 * @returns {Array} Quaternion as [w, x, y, z]
 */
export function eulerToQuaternion(euler) {
  const _x = euler[0] * 0.5;  // X rotation (roll)
  const _y = euler[1] * 0.5;  // Y rotation (pitch)  
  const _z = euler[2] * 0.5;  // Z rotation (yaw)

  const cX = Math.cos(_x);
  const cY = Math.cos(_y);
  const cZ = Math.cos(_z);

  const sX = Math.sin(_x);
  const sY = Math.sin(_y);
  const sZ = Math.sin(_z);

  // XYZ order quaternion calculation
  return [
    cX * cY * cZ - sX * sY * sZ,  // w
    sX * cY * cZ + cX * sY * sZ,  // x
    cX * sY * cZ - sX * cY * sZ,  // y
    cX * cY * sZ + sX * sY * cZ   // z
  ];
}

/**
 * Debug function: Convert quaternion back to Euler angles to verify conversion
 * @param {Array} quaternion - Quaternion as [w, x, y, z]
 * @returns {Array} Euler angles as [x, y, z] in radians
 */
export function quaternionToEuler(quaternion) {
  const [w, x, y, z] = quaternion;
  
  // Roll (x-axis rotation)
  const sinr_cosp = 2 * (w * x + y * z);
  const cosr_cosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);
  
  // Pitch (y-axis rotation)
  const sinp = 2 * (w * y - z * x);
  let pitch;
  if (Math.abs(sinp) >= 1) {
    pitch = Math.copysign(Math.PI / 2, sinp); // Use 90 degrees if out of range
  } else {
    pitch = Math.asin(sinp);
  }
  
  // Yaw (z-axis rotation)
  const siny_cosp = 2 * (w * z + x * y);
  const cosy_cosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(siny_cosp, cosy_cosp);
  
  return [roll, pitch, yaw];
}

/**
 * Debug function: Test euler to quaternion conversion
 * @param {Array} euler - Input Euler angles [x, y, z]
 * @returns {Object} Debug info including round-trip conversion
 */
export function debugEulerQuaternionConversion(euler) {
  const quat = eulerToQuaternion(euler);
  const backToEuler = quaternionToEuler(quat);
  
  return {
    input: euler,
    quaternion: quat,
    roundTrip: backToEuler,
    difference: [
      Math.abs(euler[0] - backToEuler[0]),
      Math.abs(euler[1] - backToEuler[1]), 
      Math.abs(euler[2] - backToEuler[2])
    ]
  };
}

// only the non-clenched value
let lastClenchSideFavoured = 0; // left=-1, right = 1
export const chooseNonClenchedFavouredHand = (clench) => {
  const isLeft = clench.meanClenchAngleLeft !== undefined;
  const isRight = clench.meanClenchAngleRight !== undefined;
  if (!isLeft && !isRight) {
    lastClenchSideFavoured = 0;
    return lastClenchSideFavoured;
  }
  const isRightAndUnclenched = isRight && !clench.isClenchRight;
  const isLeftAndUnclenched = isLeft && !clench.isClenchLeft;

  if (isRightAndUnclenched && isLeftAndUnclenched) {
    if (lastClenchSideFavoured === 0) {
      lastClenchSideFavoured = 1;
    }
    return lastClenchSideFavoured;
  }

  if (isRightAndUnclenched && (!isLeft || clench.isClenchLeft)) {
    lastClenchSideFavoured = 1;
    return lastClenchSideFavoured;
  }
  if (isLeftAndUnclenched && (!isRight || clench.isClenchRight)) {
    lastClenchSideFavoured = -1;
    return lastClenchSideFavoured;
  }

  lastClenchSideFavoured = 0;
  return lastClenchSideFavoured;
};

let lastIndexFingerExtendedSideFavoured = 0; // left=-1, right = 1
export const chooseIndexFingerFavouredHand = (isOnlyIndexFingerExtendedLeft, isOnlyIndexFingerExtendedRight) => {
  const isLeft = isOnlyIndexFingerExtendedLeft !== undefined;
  const isRight = isOnlyIndexFingerExtendedRight !== undefined;
  if (!isLeft && !isRight) {
    lastIndexFingerExtendedSideFavoured = 0;
    return lastIndexFingerExtendedSideFavoured;
  }
  const isRightAndIndexExtended = isRight && isOnlyIndexFingerExtendedRight;
  const isLeftAndIndexExtended = isLeft && isOnlyIndexFingerExtendedLeft;

  if (isRightAndIndexExtended && isLeftAndIndexExtended) {
    if (lastIndexFingerExtendedSideFavoured === 0) {
      lastIndexFingerExtendedSideFavoured = 1;
    }
    return lastIndexFingerExtendedSideFavoured;
  }

  if (isRightAndIndexExtended && (!isLeft || !isOnlyIndexFingerExtendedLeft)) {
    lastIndexFingerExtendedSideFavoured = 1;
    return lastIndexFingerExtendedSideFavoured;
  }
  if (isLeftAndIndexExtended && (!isRight || !isOnlyIndexFingerExtendedRight)) {
    lastIndexFingerExtendedSideFavoured = -1;
    return lastIndexFingerExtendedSideFavoured;
  }

  lastIndexFingerExtendedSideFavoured = 0;
  return lastIndexFingerExtendedSideFavoured;
};

// Test cases for debugging (can be removed in production)
// if (typeof window !== "undefined" && window.location.hostname === "localhost") {
//   console.log("Testing circular clamp functions...");

//   // Test case 1: Simple case within range - should return position 0.5
//   const test1 = circularClampAndNormalize(Math.PI, 0, Math.PI * 2);
//   console.log("Test 1 - π position between 0 and 2π:", test1, "Expected: 0.5");

//   // Test case 2: Angle outside range, should clamp to nearest and return position
//   const test2 = circularClampAndNormalize(-Math.PI, 0, Math.PI * 2);
//   console.log("Test 2 - -π position between 0 and 2π:", test2, "Expected: 0.5");

//   // Test case 3: Get the actual clamped angle value
//   const test3 = circularClampAndNormalizeAngle(Math.PI, 0, Math.PI * 2);
//   console.log("Test 3 - π clamped angle:", test3, "Expected: π");

//   // Test case 4: Edge case with negative angles - should return position, not negative angle
//   const test4 = circularClampAndNormalize(-4.2, 0, Math.PI * 2);
//   console.log(
//     "Test 4 - -4.2 position between 0 and 2π:",
//     test4,
//     "Expected: value between 0 and 1",
//   );

//   // Test case 5: Verify the clamped angle is always positive
//   const test5 = circularClampAndNormalizeAngle(-4.2, 0, Math.PI * 2);
//   console.log(
//     "Test 5 - -4.2 clamped angle:",
//     test5,
//     "Expected: positive value between 0 and 2π",
//   );
// }
