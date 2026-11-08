import {
  angleBetween3DCoords,
  circularClampAndNormalize,
  getCorrectedHandWorldLandmarks,
  TAU,
  chooseIndexFingerFavouredHand,
} from "./common.js";

// Constants
const NORMALIZED_MIN_ANGLE = 2.2; // rad (left direction)
const NORMALIZED_MAX_ANGLE = 3.6; // rad (right direction)

// Finger extension thresholds (angles below these indicate fingers are bent/closed)
// These thresholds are for the angle between MCP-PIP-DIP joints
// Extended fingers have larger angles, closed fingers have smaller angles
const FINGER_EXTENSION_THRESHOLD = 1.8; // radians - fingers are extended if angle > this
const THUMB_EXTENSION_THRESHOLD = 2.0; // radians - thumb has different bending pattern

// Alternative: use distance-based detection as fallback
const USE_DISTANCE_FALLBACK = true;
const FINGER_EXTENSION_DISTANCE_THRESHOLD = 0.05; // meters - minimum distance for extension

// Alternative: use relative finger length comparison (more robust)
const USE_RELATIVE_LENGTH_FALLBACK = true;

export const generateIndexFingerAngleAndAngularVelocityConverter = () => {
  // Enhanced anti-jitter smoothing configuration
  const ANGLE_SMOOTHING_FACTOR = 0.8; // More responsive (80% new, 20% previous)
  const VELOCITY_SMOOTHING_FACTOR = 0.6; // More responsive velocity smoothing
  const MIN_CHANGE_THRESHOLD = 0.02; // Reduced threshold for better responsiveness (2mrad)
  const MAX_ANGLE_CHANGE = 0.5; // Increased max change per frame for better responsiveness
  const SMOOTHING_WINDOW_SIZE = 3; // Reduced from 5 to 3 for less lag

  // Smoothing state for angles and velocities
  let previousSmoothedAngleLeft = null;
  let previousSmoothedAngleRight = null;
  let previousSmoothedVelocityLeft = null;
  let previousSmoothedVelocityRight = null;

  // Rolling window buffers for additional smoothing
  let angleBufferLeft = [];
  let angleBufferRight = [];
  let velocityBufferLeft = [];
  let velocityBufferRight = [];

  // Apply exponential smoothing to a single angle value
  const smoothAngle = (currentAngle, previousAngle, factor, threshold) => {
    if (previousAngle === null) {
      return currentAngle; // First frame, no smoothing possible
    }

    // Handle angle wrapping (difference across 0/2π boundary)
    let diff = currentAngle - previousAngle;
    if (diff > Math.PI) {
      diff -= TAU;
    } else if (diff < -Math.PI) {
      diff += TAU;
    }

    // Apply deadzone threshold to reduce micro-jitter
    if (Math.abs(diff) < threshold) {
      return previousAngle; // Keep previous value if change is too small
    }

    // Exponential smoothing: new = factor * current + (1 - factor) * previous
    const smoothed = previousAngle + factor * diff;

    // Don't normalize here - preserve the sign for forward/backward distinction
    return smoothed;
  };

  // Apply exponential smoothing to velocity values
  const smoothVelocity = (
    currentVelocity,
    previousVelocity,
    factor,
    threshold,
  ) => {
    if (previousVelocity === null) {
      return currentVelocity; // First frame, no smoothing possible
    }

    // Apply deadzone threshold to velocity changes
    const velocityDiff = currentVelocity - previousVelocity;
    if (Math.abs(velocityDiff) < threshold) {
      return previousVelocity; // Keep previous value if change is too small
    }

    // Exponential smoothing: new = factor * current + (1 - factor) * previous
    return previousVelocity + factor * velocityDiff;
  };

  // Apply rolling window smoothing for additional anti-jitter
  const smoothWithRollingWindow = (newValue, buffer, windowSize) => {
    // Add new value to buffer
    buffer.push(newValue);

    // Keep only the last N values
    if (buffer.length > windowSize) {
      buffer.shift();
    }

    // Calculate median to reduce outlier influence
    if (buffer.length >= 3) {
      const sorted = [...buffer].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }

    // If not enough values, return average
    return buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
  };

  // Check if only the index finger is extended (all other fingers are closed)
  const isOnlyIndexFingerExtended = (keypoints3D) => {
    if (!keypoints3D || keypoints3D.length < 21) {
      return false;
    }

    // For finger extension detection, we need to check the angle between:
    // - Wrist to MCP joint (base of finger)
    // - MCP joint to PIP joint (first finger segment)
    // - PIP joint to DIP joint (second finger segment)

    // Check index finger - should be extended (large angle)
    const indexAngle = angleBetween3DCoords(
      keypoints3D[5], // Index MCP (base)
      keypoints3D[6], // Index PIP (middle)
      keypoints3D[7], // Index DIP (tip)
    );
    const isIndexExtended = indexAngle > FINGER_EXTENSION_THRESHOLD;

    // Check middle finger - should be closed (small angle)
    const middleAngle = angleBetween3DCoords(
      keypoints3D[9], // Middle MCP (base)
      keypoints3D[10], // Middle PIP (middle)
      keypoints3D[11], // Middle DIP (tip)
    );
    const isMiddleClosed = middleAngle <= FINGER_EXTENSION_THRESHOLD;

    // Check ring finger - should be closed (small angle)
    const ringAngle = angleBetween3DCoords(
      keypoints3D[13], // Ring MCP (base)
      keypoints3D[14], // Ring PIP (middle)
      keypoints3D[15], // Ring DIP (tip)
    );
    const isRingClosed = ringAngle <= FINGER_EXTENSION_THRESHOLD;

    // Check pinky finger - should be closed (small angle)
    const pinkyAngle = angleBetween3DCoords(
      keypoints3D[17], // Pinky MCP (base)
      keypoints3D[18], // Pinky PIP (middle)
      keypoints3D[19], // Pinky DIP (tip)
    );
    const isPinkyClosed = pinkyAngle <= FINGER_EXTENSION_THRESHOLD;

    // Check thumb - should be closed (small angle)
    const thumbAngle = angleBetween3DCoords(
      keypoints3D[1], // Thumb CMC (base)
      keypoints3D[2], // Thumb MCP (middle)
      keypoints3D[3], // Thumb IP (tip)
    );
    const isThumbClosed = thumbAngle <= THUMB_EXTENSION_THRESHOLD;

    // Debug logging to see what's happening
    // console.log("Finger angles:", {
    //   index: indexAngle.toFixed(2),
    //   middle: middleAngle.toFixed(2),
    //   ring: ringAngle.toFixed(2),
    //   pinky: pinkyAngle.toFixed(2),
    //   thumb: thumbAngle.toFixed(2),
    //   threshold: FINGER_EXTENSION_THRESHOLD,
    //   thumbThreshold: THUMB_EXTENSION_THRESHOLD,
    // });

    // console.log("Extension status:", {
    //   index: isIndexExtended,
    //   middle: isMiddleClosed,
    //   ring: isRingClosed,
    //   pinky: isPinkyClosed,
    //   thumb: isThumbClosed,
    // });

    // Only index finger should be extended, all others should be closed
    const angleBasedResult = isIndexExtended && isMiddleClosed &&
      isRingClosed && isPinkyClosed && isThumbClosed;

    // If angle-based detection fails and we have distance fallback enabled, try distance-based detection
    if (!angleBasedResult && USE_DISTANCE_FALLBACK) {
      // console.log(
      //   "Angle-based detection failed, trying distance-based fallback...",
      // );

      // Calculate distances from wrist to finger tips
      const wrist = keypoints3D[0];

      // Index finger distance (should be long)
      const indexDistance = Math.sqrt(
        Math.pow(keypoints3D[8].x - wrist.x, 2) +
          Math.pow(keypoints3D[8].y - wrist.y, 2) +
          Math.pow(keypoints3D[8].z - wrist.z, 2),
      );

      // Middle finger distance (should be short)
      const middleDistance = Math.sqrt(
        Math.pow(keypoints3D[12].x - wrist.x, 2) +
          Math.pow(keypoints3D[12].y - wrist.y, 2) +
          Math.pow(keypoints3D[12].z - wrist.z, 2),
      );

      // Ring finger distance (should be short)
      const ringDistance = Math.sqrt(
        Math.pow(keypoints3D[16].x - wrist.x, 2) +
          Math.pow(keypoints3D[16].y - wrist.y, 2) +
          Math.pow(keypoints3D[16].z - wrist.z, 2),
      );

      // Pinky finger distance (should be short)
      const pinkyDistance = Math.sqrt(
        Math.pow(keypoints3D[20].x - wrist.x, 2) +
          Math.pow(keypoints3D[20].y - wrist.y, 2) +
          Math.pow(keypoints3D[20].z - wrist.z, 2),
      );

      // Thumb distance (should be short)
      const thumbDistance = Math.sqrt(
        Math.pow(keypoints3D[4].x - wrist.x, 2) +
          Math.pow(keypoints3D[4].y - wrist.y, 2) +
          Math.pow(keypoints3D[4].z - wrist.z, 2),
      );

      // console.log("Distance-based detection:", {
      //   index: indexDistance.toFixed(3),
      //   middle: middleDistance.toFixed(3),
      //   ring: ringDistance.toFixed(3),
      //   pinky: pinkyDistance.toFixed(3),
      //   thumb: thumbDistance.toFixed(3),
      //   threshold: FINGER_EXTENSION_DISTANCE_THRESHOLD,
      // });

      // Check if index is significantly longer than others
      const isIndexLongest = indexDistance > middleDistance &&
        indexDistance > ringDistance &&
        indexDistance > pinkyDistance &&
        indexDistance > thumbDistance;

      const isIndexLongEnough =
        indexDistance > FINGER_EXTENSION_DISTANCE_THRESHOLD;

      // console.log("Distance-based result:", {
      //   isIndexLongest,
      //   isIndexLongEnough,
      // });

      return isIndexLongest && isIndexLongEnough;
    }

    // If both angle and distance methods fail, try relative length comparison
    if (!angleBasedResult && USE_RELATIVE_LENGTH_FALLBACK) {
      // console.log("Trying relative length fallback...");

      // Calculate the length of each finger segment (MCP to tip)
      const indexLength = Math.sqrt(
        Math.pow(keypoints3D[8].x - keypoints3D[5].x, 2) +
          Math.pow(keypoints3D[8].y - keypoints3D[5].y, 2) +
          Math.pow(keypoints3D[8].z - keypoints3D[5].z, 2),
      );

      const middleLength = Math.sqrt(
        Math.pow(keypoints3D[12].x - keypoints3D[9].x, 2) +
          Math.pow(keypoints3D[12].y - keypoints3D[9].y, 2) +
          Math.pow(keypoints3D[12].z - keypoints3D[9].z, 2),
      );

      const ringLength = Math.sqrt(
        Math.pow(keypoints3D[16].x - keypoints3D[13].x, 2) +
          Math.pow(keypoints3D[16].y - keypoints3D[13].y, 2) +
          Math.pow(keypoints3D[16].z - keypoints3D[13].z, 2),
      );

      const pinkyLength = Math.sqrt(
        Math.pow(keypoints3D[20].x - keypoints3D[17].x, 2) +
          Math.pow(keypoints3D[20].y - keypoints3D[17].y, 2) +
          Math.pow(keypoints3D[20].z - keypoints3D[17].z, 2),
      );

      // console.log("Relative lengths:", {
      //   index: indexLength.toFixed(3),
      //   middle: middleLength.toFixed(3),
      //   ring: ringLength.toFixed(3),
      //   pinky: pinkyLength.toFixed(3),
      // });

      // Check if index finger is significantly longer than others (indicating it's extended)
      const lengthThreshold = 0.02; // 2cm difference threshold
      const isIndexLonger = (indexLength - middleLength) > lengthThreshold &&
        (indexLength - ringLength) > lengthThreshold &&
        (indexLength - pinkyLength) > lengthThreshold;

      // console.log("Relative length result:", {
      //   isIndexLonger,
      //   lengthThreshold,
      // });

      return isIndexLonger;
    }

    return angleBasedResult;
  };

  // Calculate the angle between wrist-to-index-finger-tip segment and the horizontal floor plane (XZ plane)
  const calculateIndexFingerAngle = (keypoints3D) => {
    const wrist = keypoints3D[0]; // Wrist (landmark 0)
    const indexFingerTip = keypoints3D[8]; // Index finger tip (landmark 8)

    // Vector from wrist to index finger tip
    const wristToIndexTip = {
      x: indexFingerTip.x - wrist.x,
      y: indexFingerTip.y - wrist.y,
      z: indexFingerTip.z - wrist.z,
    };

    // Calculate the angle in the XZ plane (horizontal plane)
    // This gives us the angle from the forward direction (Z-axis) in the horizontal plane
    // 0 = pointing forward, π/2 = pointing right, π = pointing backward, -π/2 = pointing left

    const wristToIndexTipLength = Math.sqrt(
      wristToIndexTip.x * wristToIndexTip.x +
        wristToIndexTip.y * wristToIndexTip.y +
        wristToIndexTip.z * wristToIndexTip.z,
    );

    if (wristToIndexTipLength === 0) {
      return 0;
    }

    // Calculate angle in XZ plane (horizontal plane)
    // atan2(x, z) gives us the angle from the positive Z axis (forward direction)
    let angle = Math.atan2(wristToIndexTip.x, wristToIndexTip.z);



    // Ensure angle is properly normalized to [-π, π] range
    // This handles any edge cases where atan2 might return values outside this range
    while (angle > Math.PI) {
      angle -= TAU;
    }
    while (angle < -Math.PI) {
      angle += TAU;
    }

    return angle;
  };

  // Convert right or any hand: angular velocity with smoothing
  return (hands) => {
    if (!hands) {
      return;
    }
    const [keypoints3DLeft, keypoints3DRight] = getCorrectedHandWorldLandmarks(
      hands,
    );

    let smoothedAngleRight, smoothedVelocityRight;
    if (keypoints3DRight) {
      // Only calculate index finger angle if only the index finger is extended
      const isIndexOnlyExtended = isOnlyIndexFingerExtended(keypoints3DRight);
      // console.log("RIGHT: isIndexOnlyExtended", isIndexOnlyExtended);

      if (isIndexOnlyExtended) {
        const angle = calculateIndexFingerAngle(keypoints3DRight);

                 // Apply basic smoothing to angle for responsiveness
         smoothedAngleRight = smoothAngle(
           angle,
           previousSmoothedAngleRight,
           ANGLE_SMOOTHING_FACTOR,
           MIN_CHANGE_THRESHOLD,
         );

        // Calculate angular velocity (radians per second) - simplified and stable
        if (previousSmoothedAngleRight !== null) {
          const angleDiff = smoothedAngleRight - previousSmoothedAngleRight;

          // Simple velocity calculation using fixed time step
          const velocity = angleDiff / 0.016; // 60fps = 16ms per frame

                     // Apply basic velocity smoothing
           smoothedVelocityRight = smoothVelocity(
             velocity,
             previousSmoothedVelocityRight,
             VELOCITY_SMOOTHING_FACTOR,
             MIN_CHANGE_THRESHOLD,
           );
        } else {
          smoothedVelocityRight = 0;
        }

        previousSmoothedAngleRight = smoothedAngleRight;
        previousSmoothedVelocityRight = smoothedVelocityRight || 0; // Ensure it's always a number
      } else {
        // Reset values when index finger is not exclusively extended
        smoothedAngleRight = undefined;
        smoothedVelocityRight = undefined;
        previousSmoothedAngleRight = null;
        previousSmoothedVelocityRight = null;

                 // Clear velocity buffer to prevent stale data
         velocityBufferRight = [];
      }
    }

    let smoothedAngleLeft, smoothedVelocityLeft;
    if (keypoints3DLeft) {
      // Only calculate index finger angle if only the index finger is extended
      const isIndexOnlyExtended = isOnlyIndexFingerExtended(keypoints3DLeft);
      // console.log("LEFT: isIndexOnlyExtended", isIndexOnlyExtended);

      if (isIndexOnlyExtended) {
        const angle = calculateIndexFingerAngle(keypoints3DLeft);

                 // Apply basic smoothing to angle for responsiveness
         smoothedAngleLeft = smoothAngle(
           angle,
           previousSmoothedAngleLeft,
           ANGLE_SMOOTHING_FACTOR,
           MIN_CHANGE_THRESHOLD,
         );

        // Calculate angular velocity (radians per second) - simplified and stable
        if (previousSmoothedAngleLeft !== null) {
          const angleDiff = smoothedAngleLeft - previousSmoothedAngleLeft;

          // Simple velocity calculation using fixed time step
          const velocity = angleDiff / 0.016; // 60fps = 16ms per frame

                     // Apply basic velocity smoothing
           smoothedVelocityLeft = smoothVelocity(
             velocity,
             previousSmoothedVelocityLeft,
             VELOCITY_SMOOTHING_FACTOR,
             MIN_CHANGE_THRESHOLD,
           );
        } else {
          smoothedVelocityLeft = 0;
        }

        previousSmoothedAngleLeft = smoothedAngleLeft;
        previousSmoothedVelocityLeft = smoothedVelocityLeft || 0; // Ensure it's always a number
      } else {
        // Reset values when index finger is not exclusively extended
        smoothedAngleLeft = undefined;
        smoothedVelocityLeft = undefined;
        previousSmoothedAngleLeft = null;
        previousSmoothedVelocityLeft = null;

                 // Clear velocity buffer to prevent stale data
         velocityBufferLeft = [];
      }
    }

    // Normalize velocities to [0, 1] range for easier downstream processing
    // Assuming max reasonable angular velocity is 10 rad/s
    const MAX_ANGULAR_VELOCITY = 10;
    const rightNormalizedVelocity = smoothedVelocityRight === undefined
      ? undefined
      : Math.max(-1, Math.min(1, smoothedVelocityRight / MAX_ANGULAR_VELOCITY));
    const leftNormalizedVelocity = smoothedVelocityLeft === undefined
      ? undefined
      : Math.max(-1, Math.min(1, smoothedVelocityLeft / MAX_ANGULAR_VELOCITY));

    // Ensure velocities are never NaN
    const safeRightVelocity = isNaN(smoothedVelocityRight)
      ? 0
      : smoothedVelocityRight;
    const safeLeftVelocity = isNaN(smoothedVelocityLeft)
      ? 0
      : smoothedVelocityLeft;

    // Apply additional smoothing to normalized values to reduce jitter
    const smoothedNormalizedLeft = smoothedAngleLeft !== undefined
      ? circularClampAndNormalize(
        smoothedAngleLeft,
        NORMALIZED_MIN_ANGLE,
        NORMALIZED_MAX_ANGLE,
      )
      : undefined;

    const smoothedNormalizedRight = smoothedAngleRight !== undefined
      ? circularClampAndNormalize(
        smoothedAngleRight,
        NORMALIZED_MIN_ANGLE,
        NORMALIZED_MAX_ANGLE,
      )
      : undefined;

    const isOnlyIndexFingerExtendedLeft = isOnlyIndexFingerExtended(keypoints3DLeft);
    const isOnlyIndexFingerExtendedRight = isOnlyIndexFingerExtended(keypoints3DRight);
    const indexFingerFavouredHand = chooseIndexFingerFavouredHand(isOnlyIndexFingerExtendedLeft, isOnlyIndexFingerExtendedRight);

    return {
      indexFingerAngle: indexFingerFavouredHand === -1 ? smoothedAngleLeft : indexFingerFavouredHand === 1 ? smoothedAngleRight : undefined,
      indexFingerAngleNormalized: indexFingerFavouredHand === -1 ? smoothedNormalizedLeft : indexFingerFavouredHand === 1 ? smoothedNormalizedRight : undefined,
      indexFingerRotationalVelocity: indexFingerFavouredHand === -1 ? safeLeftVelocity : indexFingerFavouredHand === 1 ? safeRightVelocity : undefined,
      indexFingerRotationalVelocityNormalized: indexFingerFavouredHand === -1 ? leftNormalizedVelocity : indexFingerFavouredHand === 1 ? rightNormalizedVelocity : undefined,
      indexFingerAngleLeft: smoothedAngleLeft,
      indexFingerAngleRight: smoothedAngleRight,
      indexFingerAngleNormalizedLeft: smoothedNormalizedLeft,
      indexFingerAngleNormalizedRight: smoothedNormalizedRight,
      indexFingerRotationalVelocityLeft: safeLeftVelocity,
      indexFingerRotationalVelocityRight: safeRightVelocity,
      indexFingerRotationalVelocityNormalizedLeft: leftNormalizedVelocity,
      indexFingerRotationalVelocityNormalizedRight: rightNormalizedVelocity,
    };
  };
};

// // Test cases for debugging (can be removed in production)
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

//   console.log("Finger extension thresholds:");
//   console.log(
//     "- FINGER_EXTENSION_THRESHOLD:",
//     FINGER_EXTENSION_THRESHOLD,
//     "radians",
//   );
//   console.log(
//     "- THUMB_EXTENSION_THRESHOLD:",
//     THUMB_EXTENSION_THRESHOLD,
//     "radians",
//   );
//
//   // Test the finger extension detection with mock data
//   console.log("Testing finger extension detection...");
//
//   // Mock hand data for testing (you can adjust these values)
//   const mockHandData = {
//     0: { x: 0, y: 0, z: 0 },      // Wrist
//     1: { x: 0.02, y: 0.01, z: 0 }, // Thumb CMC
//     2: { x: 0.03, y: 0.01, z: 0 }, // Thumb MCP
//     3: { x: 0.04, y: 0.01, z: 0 }, // Thumb IP
//     4: { x: 0.05, y: 0.01, z: 0 }, // Thumb tip
//     5: { x: 0.01, y: 0, z: 0 },    // Index MCP
//     6: { x: 0.01, y: 0.02, z: 0 }, // Index PIP
//     7: { x: 0.01, y: 0.04, z: 0 }, // Index DIP
//     8: { x: 0.01, y: 0.06, z: 0 }, // Index tip
//     9: { x: 0.02, y: 0, z: 0 },    // Middle MCP
//     10: { x: 0.02, y: 0.01, z: 0 }, // Middle PIP
//     11: { x: 0.02, y: 0.02, z: 0 }, // Middle DIP
//     12: { x: 0.02, y: 0.03, z: 0 }, // Middle tip
//     13: { x: 0.03, y: 0, z: 0 },   // Ring MCP
//     14: { x: 0.03, y: 0.01, z: 0 }, // Ring PIP
//     15: { x: 0.03, y: 0.02, z: 0 }, // Ring DIP
//     16: { x: 0.03, y: 0.03, z: 0 }, // Ring tip
//     17: { x: 0.04, y: 0, z: 0 },   // Pinky MCP
//     18: { x: 0.04, y: 0.01, z: 0 }, // Pinky PIP
//     19: { x: 0.04, y: 0.02, z: 0 }, // Pinky DIP
//     20: { x: 0.04, y: 0.03, z: 0 }, // Pinky tip
//   };
//
//   // Convert to array format
//   const mockHandArray = Object.values(mockHandData);
//
//   // Test the function
//   try {
//     const result = isOnlyIndexFingerExtended(mockHandArray);
//     console.log("Mock hand test result:", result);
//   } catch (error) {
//     console.error("Error testing mock hand:", error);
//   }
// }
