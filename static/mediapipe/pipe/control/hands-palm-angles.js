import {
  circularClampAndNormalize,
  getCorrectedHandWorldLandmarks,
  TAU,
} from "./common.js";

// Constants for velocity thresholds
// const FORWARD_VELOCITY_THRESHOLD = 9.0; // rad/s
// const BACKWARD_VELOCITY_THRESHOLD = -7.0; // rad/s
const NORMALIZED_MIN_ANGLE = 1.8; // rad
const NORMALIZED_MAX_ANGLE = 2.8; // rad

export const generatehandAnglesAndAngularVelocityConverter = () => {
  // Smoothing configuration
  const ANGLE_SMOOTHING_FACTOR = 1.0; // Keep angles responsive (no smoothing)
  const VELOCITY_SMOOTHING_FACTOR = 0.3; // Smooth velocities to reduce noise
  const MIN_CHANGE_THRESHOLD = 0.001; // Ignore changes smaller than this to reduce micro-jitter

  // Smoothing state for angles and velocities
  let previousSmoothedAngleLeft = null;
  let previousSmoothedAngleRight = null;
  let previousSmoothedVelocityLeft = null;
  let previousSmoothedVelocityRight = null;

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

    // Exponential smoothing: new = factor * current + (1 - factor) * previous
    return previousVelocity + factor * (currentVelocity - previousVelocity);
  };

  // Calculate the angle between wrist-to-pinky segment and the horizontal floor plane
  const calculateWaveAngle = (keypoints3D) => {
    const wrist = keypoints3D[0]; // Wrist (landmark 0)
    const pinkyMCP = keypoints3D[17]; // Pinky MCP (landmark 17)

    // Vector from wrist to pinky MCP
    const wristToPinky = {
      x: pinkyMCP.x - wrist.x,
      y: pinkyMCP.y - wrist.y,
      z: pinkyMCP.z - wrist.z,
    };

    // The floor plane is horizontal (Y = constant), so its normal is (0, 1, 0)
    // const floorNormal = { x: 0, y: 1, z: 0 };

    // Calculate the angle between the wrist-to-pinky vector and the floor plane
    // The floor plane is horizontal, so we just need the angle from horizontal
    const wristToPinkyLength = Math.sqrt(
      wristToPinky.x * wristToPinky.x + wristToPinky.y * wristToPinky.y +
        wristToPinky.z * wristToPinky.z,
    );

    if (wristToPinkyLength === 0) {
      return 0;
    }

    // Use continuous angle from 0 to π to eliminate flipping
    // 0 = inline with floor (one direction), π/2 = straight up, π = inline with floor (other direction)

    // With this single line:
    return -Math.atan2(wristToPinky.y, wristToPinky.z);
    // claude says this isn't needed
    // // Calculate the angle from the positive Z axis (forward direction)
    // const angleFromForward = Math.atan2(wristToPinky.y, wristToPinky.z);

    // // Convert to 0 to π range
    // // atan2 gives us -π to π, we want 0 to π
    // let continuousAngle;
    // if (angleFromForward >= 0) {
    //   // 0 to π/2: forward direction
    //   continuousAngle = angleFromForward;
    // } else {
    //   // -π to 0: backward direction, map to π/2 to π
    //   continuousAngle = Math.PI + angleFromForward;
    // }

    // // This is better intution from the UI display
    // return -continuousAngle;
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
      const angle = calculateWaveAngle(keypoints3DRight);

      // Apply smoothing to angle
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

        // Apply smoothing to velocity
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
    }

    let smoothedAngleLeft, smoothedVelocityLeft;
    if (keypoints3DLeft) {
      const angle = calculateWaveAngle(keypoints3DLeft);

      // Apply smoothing to angle
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

        // Apply smoothing to velocity
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

    return {
      palmAngleLeft: smoothedAngleLeft,
      palmAngleRight: smoothedAngleRight,
      palmAngleNormalizedClampedLeft: circularClampAndNormalize(
        smoothedAngleLeft,
        NORMALIZED_MIN_ANGLE,
        NORMALIZED_MAX_ANGLE,
      ),
      palmAngleNormalizedClampedRight: circularClampAndNormalize(
        smoothedAngleRight,
        NORMALIZED_MIN_ANGLE,
        NORMALIZED_MAX_ANGLE,
      ),
      palmRotationalVelocityLeft: safeLeftVelocity,
      palmRotationalVelocityRight: safeRightVelocity,
      palmRotationalVelocityNormalizedLeft: leftNormalizedVelocity,
      palmRotationalVelocityNormalizedRight: rightNormalizedVelocity,
    };
  };
};
