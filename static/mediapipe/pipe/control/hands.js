import { detectClench } from "./hands-clench.js";
import { calculateWristRotation } from "./hands-rotation.js";
import {
  chooseNonClenchedFavouredHand,
  getCorrectedHandWorldLandmarks,
} from "./common.js";
import { generatehandAnglesAndAngularVelocityConverter } from "./hands-palm-angles.js";
import { generateHandsToAngleConverter } from "./hands-palm-orthgonal-direction.js";
import { calculateHandsSplay } from "./hands-splay.js";
import { generateIndexFingerAngleAndAngularVelocityConverter } from "./hands-index-finger-angle.js";

export const generateHandsControl = () => {
  const calculateHandWaveVelocity =
    generatehandAnglesAndAngularVelocityConverter();
  const calculateHandPalmDirection = generateHandsToAngleConverter();
  const calculateIndexFingerAngleAndAngularVelocity =
    generateIndexFingerAngleAndAngularVelocityConverter();

  return (hands) => {
    const clench = detectClench(hands);

    const [keypoints3DLeft, keypoints3DRight] = getCorrectedHandWorldLandmarks(
      hands,
    );
    const wristRotationLeft = calculateWristRotation(keypoints3DLeft);
    const wristRotationRight = calculateWristRotation(keypoints3DRight);

    const handAnglesAndAngularVelocity = calculateHandWaveVelocity(hands);
    const handPalmOrthogonal = calculateHandPalmDirection(hands);
    const handSplay = calculateHandsSplay(hands);

    const indexFingerAngleAndAngularVelocity =
      calculateIndexFingerAngleAndAngularVelocity(hands);

    // add some clench filtering (do not use the hand that is clenched)
    const favouredHandBasedOnClench = chooseNonClenchedFavouredHand(clench);

    const palmOrthogonalEulerNotClenched = favouredHandBasedOnClench === -1
      ? handPalmOrthogonal.palmOrthogonalEulerLeft
      : favouredHandBasedOnClench === 1
      ? handPalmOrthogonal.palmOrthogonalEulerRight
      : undefined;
    const palmOrthogonalQuaternionNotClenched = favouredHandBasedOnClench === -1
      ? handPalmOrthogonal.palmOrthogonalQuaternionLeft
      : favouredHandBasedOnClench === 1
      ? handPalmOrthogonal.palmOrthogonalQuaternionRight
      : undefined;
    const wristRotationNotClenched = favouredHandBasedOnClench === -1
      ? wristRotationLeft
      : favouredHandBasedOnClench === 1
      ? wristRotationRight
      : undefined;
    const handSplayNotClenched = favouredHandBasedOnClench === -1
      ? handSplay.handSplayLeft
      : favouredHandBasedOnClench === 1
      ? handSplay.handSplayRight
      : undefined;

    const isPalmFlatLeft = handSplay?.isHandSplayLeftFlat &&
      clench?.meanClenchAngleLeft >= 2.8;
    const isPalmFlatRight = handSplay?.isHandSplayRightFlat &&
      clench?.meanClenchAngleRight >= 2.8;

    return {
      clench,
      wristRotationLeft,
      wristRotationRight,
      palmOrthogonalEulerNotClenched,
      palmOrthogonalQuaternionNotClenched,
      wristRotationNotClenched,
      ...handAnglesAndAngularVelocity,
      ...handPalmOrthogonal,
      ...handSplay,
      ...indexFingerAngleAndAngularVelocity,
      handSplayNotClenched,
      isPalmFlatLeft,
      isPalmFlatRight,
    };
  };
};
