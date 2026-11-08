import { getCorrectedHandWorldLandmarks } from "./common.js";

// ====== CONFIGURABLE CONSTANTS ======
const INCLUDE_THUMB_IN_SPLAY = false; // Whether to include thumb in splay calculation
const MIN_EXPECTED_SPLAY_ANGLE = 0.1; // Minimum angle (radians) between fingers when "closed"
const MAX_EXPECTED_SPLAY_ANGLE = 0.7; // Maximum angle (radians) between fingers when "splayed"
const SPLAY_SMOOTHING_FACTOR = 2.0; // Higher values make the transition more gradual

const THRESHOLD_MIN_EXPECTED_SPLAY_ANGLE = 0.22; // heuristic to determine flat or max splayed
const THRESHOLD_MAX_EXPECTED_SPLAY_ANGLE = 0.4; // heuristic to determine flat or max splayed

// Pre-computed finger pair indices for better performance
// Format: [base1, tip1, base2, tip2] for each adjacent finger pair
const FINGER_PAIR_INDICES = INCLUDE_THUMB_IN_SPLAY
  ? [
      [1, 4, 5, 8],   // thumb to index
      [5, 8, 9, 12],  // index to middle  
      [9, 12, 13, 16], // middle to ring
      [13, 16, 17, 20] // ring to pinky
    ]
  : [
      [5, 8, 9, 12],   // index to middle
      [9, 12, 13, 16], // middle to ring  
      [13, 16, 17, 20] // ring to pinky
    ];

// Pre-compute normalization constants
const ANGLE_RANGE = MAX_EXPECTED_SPLAY_ANGLE - MIN_EXPECTED_SPLAY_ANGLE;
const INV_SMOOTHING_FACTOR = 1 / SPLAY_SMOOTHING_FACTOR;

/**
 * Calculates how "splayed" the fingers are based on MediaPipe hand landmarks
 * @param {Array} landmarks - Array of 21 MediaPipe hand landmarks, each with {x, y, z} properties
 * @returns {number} Splay score from 0.0 (fingers aligned/closed) to 1.0 (fingers maximally splayed)
 */
function calculateFingerSplay(landmarks) {
  if (!landmarks || landmarks.length !== 21) {
    return undefined;
  }

  let angleSum = 0;
  let validAngles = 0;

  // Process each finger pair directly without creating intermediate objects
  for (let i = 0; i < FINGER_PAIR_INDICES.length; i++) {
    const [base1, tip1, base2, tip2] = FINGER_PAIR_INDICES[i];
    
    // Calculate first finger vector components
    const v1x = landmarks[tip1].x - landmarks[base1].x;
    const v1y = landmarks[tip1].y - landmarks[base1].y;
    const v1z = landmarks[tip1].z - landmarks[base1].z;
    
    // Calculate second finger vector components
    const v2x = landmarks[tip2].x - landmarks[base2].x;
    const v2y = landmarks[tip2].y - landmarks[base2].y;
    const v2z = landmarks[tip2].z - landmarks[base2].z;

    // Calculate squared magnitudes first to avoid unnecessary sqrt calls
    const mag1Sq = v1x * v1x + v1y * v1y + v1z * v1z;
    const mag2Sq = v2x * v2x + v2y * v2y + v2z * v2z;
    
    // Skip if either vector has zero magnitude
    if (mag1Sq === 0 || mag2Sq === 0) continue;
    
    // Calculate actual magnitudes only when needed
    const mag1 = Math.sqrt(mag1Sq);
    const mag2 = Math.sqrt(mag2Sq);
    
    // Calculate dot product and angle
    const dotProduct = v1x * v2x + v1y * v2y + v1z * v2z;
    const cosTheta = dotProduct / (mag1 * mag2);
    
    // Clamp to valid range for arccos and calculate angle
    const clampedCosTheta = Math.max(-1, Math.min(1, cosTheta));
    const angle = Math.acos(clampedCosTheta);

    // Accumulate valid angles directly
    if (!isNaN(angle)) {
      angleSum += angle;
      validAngles++;
    }
  }

  // Return early if no valid angles
  if (validAngles === 0) {
    return 0;
  }

  // Calculate average angle and normalize in one step
  const averageAngle = angleSum / validAngles;
  const normalizedAngle = (averageAngle - MIN_EXPECTED_SPLAY_ANGLE) / ANGLE_RANGE;
  
  // Apply smoothing and clamp to 0-1 range
  return Math.pow(Math.max(0, Math.min(1, normalizedAngle)), INV_SMOOTHING_FACTOR);
}

// Alternative version that completely avoids the sqrt calls when only relative angles matter
// This is more efficient but may be less accurate for edge cases
function calculateFingerSplayFast(landmarks) {
  if (!landmarks || landmarks.length !== 21) {
    return undefined;
  }

  let angleSum = 0;
  let validAngles = 0;

  for (let i = 0; i < FINGER_PAIR_INDICES.length; i++) {
    const [base1, tip1, base2, tip2] = FINGER_PAIR_INDICES[i];
    
    // Calculate finger vector components
    const v1x = landmarks[tip1].x - landmarks[base1].x;
    const v1y = landmarks[tip1].y - landmarks[base1].y;
    const v1z = landmarks[tip1].z - landmarks[base1].z;
    
    const v2x = landmarks[tip2].x - landmarks[base2].x;
    const v2y = landmarks[tip2].y - landmarks[base2].y;
    const v2z = landmarks[tip2].z - landmarks[base2].z;

    // Calculate squared magnitudes
    const mag1Sq = v1x * v1x + v1y * v1y + v1z * v1z;
    const mag2Sq = v2x * v2x + v2y * v2y + v2z * v2z;
    
    if (mag1Sq === 0 || mag2Sq === 0) continue;
    
    // Use squared magnitudes to avoid sqrt (less precise but faster)
    const dotProduct = v1x * v2x + v1y * v2y + v1z * v2z;
    const cosTheta = dotProduct / Math.sqrt(mag1Sq * mag2Sq);
    
    const clampedCosTheta = Math.max(-1, Math.min(1, cosTheta));
    const angle = Math.acos(clampedCosTheta);

    if (!isNaN(angle)) {
      angleSum += angle;
      validAngles++;
    }
  }

  if (validAngles === 0) {
    return 0;
  }

  const averageAngle = angleSum / validAngles;
  const normalizedAngle = (averageAngle - MIN_EXPECTED_SPLAY_ANGLE) / ANGLE_RANGE;
  
  return Math.pow(Math.max(0, Math.min(1, normalizedAngle)), INV_SMOOTHING_FACTOR);
}

export const calculateHandsSplay = (hands) => {
  
  const [keypoints3DLeft, keypoints3DRight] = getCorrectedHandWorldLandmarks(
    hands
  );
  const leftSplay = calculateFingerSplay(keypoints3DLeft);
  const rightSplay = calculateFingerSplay(keypoints3DRight);
  const isLeftSplayedMax = leftSplay !== undefined
        ? leftSplay >= THRESHOLD_MAX_EXPECTED_SPLAY_ANGLE
        : undefined;
  const isRightSplayedMax = rightSplay !== undefined
        ? rightSplay >= THRESHOLD_MAX_EXPECTED_SPLAY_ANGLE
        : undefined;
  const isLeftFlat = leftSplay !== undefined
        ? leftSplay < THRESHOLD_MIN_EXPECTED_SPLAY_ANGLE
        : undefined;
  const isRightFlat =
      rightSplay !== undefined
        ? rightSplay < THRESHOLD_MIN_EXPECTED_SPLAY_ANGLE
        : undefined;

  return {
    handSplayLeft:leftSplay,
    isHandSplayLeftMax:isLeftSplayedMax,
    isHandSplayLeftFlat:isLeftFlat,
    handSplayRight:rightSplay,
    isHandSplayRightMax:isRightSplayedMax,
    isHandSplayRightFlat:isRightFlat,
  };
};
