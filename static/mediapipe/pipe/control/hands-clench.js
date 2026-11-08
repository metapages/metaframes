import {
  angleBetween3DCoords,
  getCorrectedHandWorldLandmarks,
} from './common.js';

/**
 * Outputs: {clench:<0|1>}
 */
// Configurable constants
// less than this triggers a "clench"
const ClenchMeanAngleThreshholdOneAnglePerFinger = 1.4;
const ClenchMeanAngleThreshholdMultipleAnglesPerFinger = 2.3;
const ThumbAngleThreshold = 2.8; // Thumb bends differently, so separate threshold
const DIPAngleWeight = 0.8; // Weight for DIP joint angles
const PIPAngleWeight = 1.0; // Weight for PIP joint angles (original)
const ThumbAngleWeight = 0.9; // Weight for thumb angles
const MCPAngleWeight = 0.7; // Weight for MCP joint angles

let meanAngleRight = undefined;
let meanAngleLeft = undefined;
let clenchRight = false;
let clenchLeft = false;


const detectClenchMultipleAnglesMoreFingers = (hands) => {
  if (!hands) {
    return;
  }
  const [keypoints3DLeft, keypoints3DRight] =
      getCorrectedHandWorldLandmarks(hands);

  let anyClench = 0;
  clenchRight = false;
  clenchLeft = false;
  meanAngleRight = undefined;
  meanAngleLeft = undefined;
  
  if (keypoints3DRight) {
    // Original PIP joint angles (middle joints)
    const angleIndexPIPRight = angleBetween3DCoords(
      keypoints3DRight[5],
      keypoints3DRight[6],
      keypoints3DRight[7],
    );
    const angleMiddlePIPRight = angleBetween3DCoords(
      keypoints3DRight[9],
      keypoints3DRight[10],
      keypoints3DRight[11],
    );
    const angleRingPIPRight = angleBetween3DCoords(
      keypoints3DRight[13],
      keypoints3DRight[14],
      keypoints3DRight[15],
    );
    const anglePinkPIPRight = angleBetween3DCoords(
      keypoints3DRight[17],
      keypoints3DRight[18],
      keypoints3DRight[19],
    );

    // DIP joint angles (fingertip joints)
    const angleIndexDIPRight = angleBetween3DCoords(
      keypoints3DRight[6],
      keypoints3DRight[7],
      keypoints3DRight[8],
    );
    const angleMiddleDIPRight = angleBetween3DCoords(
      keypoints3DRight[10],
      keypoints3DRight[11],
      keypoints3DRight[12],
    );
    const angleRingDIPRight = angleBetween3DCoords(
      keypoints3DRight[14],
      keypoints3DRight[15],
      keypoints3DRight[16],
    );
    const anglePinkDIPRight = angleBetween3DCoords(
      keypoints3DRight[18],
      keypoints3DRight[19],
      keypoints3DRight[20],
    );

    // MCP joint angles (knuckles) - using wrist as reference
    const angleIndexMCPRight = angleBetween3DCoords(
      keypoints3DRight[0],
      keypoints3DRight[5],
      keypoints3DRight[6],
    );
    const angleMiddleMCPRight = angleBetween3DCoords(
      keypoints3DRight[0],
      keypoints3DRight[9],
      keypoints3DRight[10],
    );
    const angleRingMCPRight = angleBetween3DCoords(
      keypoints3DRight[0],
      keypoints3DRight[13],
      keypoints3DRight[14],
    );
    const anglePinkMCPRight = angleBetween3DCoords(
      keypoints3DRight[0],
      keypoints3DRight[17],
      keypoints3DRight[18],
    );

    // Thumb angles
    const angleThumbIP1Right = angleBetween3DCoords(
      keypoints3DRight[1],
      keypoints3DRight[2],
      keypoints3DRight[3],
    );
    const angleThumbIP2Right = angleBetween3DCoords(
      keypoints3DRight[2],
      keypoints3DRight[3],
      keypoints3DRight[4],
    );

    // Calculate weighted mean angle
    const pipMean = (angleIndexPIPRight + angleMiddlePIPRight + angleRingPIPRight + anglePinkPIPRight) / 4;
    const dipMean = (angleIndexDIPRight + angleMiddleDIPRight + angleRingDIPRight + anglePinkDIPRight) / 4;
    const mcpMean = (angleIndexMCPRight + angleMiddleMCPRight + angleRingMCPRight + anglePinkMCPRight) / 4;
    const thumbMean = (angleThumbIP1Right + angleThumbIP2Right) / 2;

    meanAngleRight = (
      pipMean * PIPAngleWeight +
      dipMean * DIPAngleWeight +
      mcpMean * MCPAngleWeight +
      thumbMean * ThumbAngleWeight
    ) / (PIPAngleWeight + DIPAngleWeight + MCPAngleWeight + ThumbAngleWeight);

    // Enhanced clench detection - consider thumb separately due to different threshold
    const fingersClenched = meanAngleRight < ClenchMeanAngleThreshholdMultipleAnglesPerFinger;
    const thumbClenched = thumbMean < ThumbAngleThreshold;
    clenchRight = fingersClenched && thumbClenched;
    anyClench = anyClench + (clenchRight ? 1 : 0);
  }

  if (keypoints3DLeft) {    
    // Original PIP joint angles (middle joints)
    const angleIndexPIPLeft = angleBetween3DCoords(
      keypoints3DLeft[5],
      keypoints3DLeft[6],
      keypoints3DLeft[7],
    );
    const angleMiddlePIPLeft = angleBetween3DCoords(
      keypoints3DLeft[9],
      keypoints3DLeft[10],
      keypoints3DLeft[11],
    );
    const angleRingPIPLeft = angleBetween3DCoords(
      keypoints3DLeft[13],
      keypoints3DLeft[14],
      keypoints3DLeft[15],
    );
    const anglePinkPIPLeft = angleBetween3DCoords(
      keypoints3DLeft[17],
      keypoints3DLeft[18],
      keypoints3DLeft[19],
    );

    // DIP joint angles (fingertip joints)
    const angleIndexDIPLeft = angleBetween3DCoords(
      keypoints3DLeft[6],
      keypoints3DLeft[7],
      keypoints3DLeft[8],
    );
    const angleMiddleDIPLeft = angleBetween3DCoords(
      keypoints3DLeft[10],
      keypoints3DLeft[11],
      keypoints3DLeft[12],
    );
    const angleRingDIPLeft = angleBetween3DCoords(
      keypoints3DLeft[14],
      keypoints3DLeft[15],
      keypoints3DLeft[16],
    );
    const anglePinkDIPLeft = angleBetween3DCoords(
      keypoints3DLeft[18],
      keypoints3DLeft[19],
      keypoints3DLeft[20],
    );

    // MCP joint angles (knuckles) - using wrist as reference
    const angleIndexMCPLeft = angleBetween3DCoords(
      keypoints3DLeft[0],
      keypoints3DLeft[5],
      keypoints3DLeft[6],
    );
    const angleMiddleMCPLeft = angleBetween3DCoords(
      keypoints3DLeft[0],
      keypoints3DLeft[9],
      keypoints3DLeft[10],
    );
    const angleRingMCPLeft = angleBetween3DCoords(
      keypoints3DLeft[0],
      keypoints3DLeft[13],
      keypoints3DLeft[14],
    );
    const anglePinkMCPLeft = angleBetween3DCoords(
      keypoints3DLeft[0],
      keypoints3DLeft[17],
      keypoints3DLeft[18],
    );

    // Thumb angles
    const angleThumbIP1Left = angleBetween3DCoords(
      keypoints3DLeft[1],
      keypoints3DLeft[2],
      keypoints3DLeft[3],
    );
    const angleThumbIP2Left = angleBetween3DCoords(
      keypoints3DLeft[2],
      keypoints3DLeft[3],
      keypoints3DLeft[4],
    );

    // Calculate weighted mean angle
    const pipMean = (angleIndexPIPLeft + angleMiddlePIPLeft + angleRingPIPLeft + anglePinkPIPLeft) / 4;
    const dipMean = (angleIndexDIPLeft + angleMiddleDIPLeft + angleRingDIPLeft + anglePinkDIPLeft) / 4;
    const mcpMean = (angleIndexMCPLeft + angleMiddleMCPLeft + angleRingMCPLeft + anglePinkMCPLeft) / 4;
    const thumbMean = (angleThumbIP1Left + angleThumbIP2Left) / 2;

    meanAngleLeft = (
      pipMean * PIPAngleWeight +
      dipMean * DIPAngleWeight +
      mcpMean * MCPAngleWeight +
      thumbMean * ThumbAngleWeight
    ) / (PIPAngleWeight + DIPAngleWeight + MCPAngleWeight + ThumbAngleWeight);

    // Enhanced clench detection - consider thumb separately due to different threshold
    const fingersClenched = meanAngleLeft < ClenchMeanAngleThreshholdMultipleAnglesPerFinger;
    const thumbClenched = thumbMean < ThumbAngleThreshold;
    clenchLeft = fingersClenched && thumbClenched;
    anyClench = anyClench + (clenchLeft ? 1 : 0);
  }

  return {
    clench: anyClench,
    isClenchLeft: clenchLeft,
    isClenchRight: clenchRight,
    meanClenchAngleRight: meanAngleRight,
    meanClenchAngleLeft: meanAngleLeft,
    meanClenchAngleRightNormalized: getNormalizedClenchAngle(meanAngleRight),
    meanClenchAngleLeftNormalized: getNormalizedClenchAngle(meanAngleLeft),
  };


};

const MIN_CLANCH_ANGLE = 1.9;
const MAX_CLANCH_ANGLE = 2.8;
const getNormalizedClenchAngle = (clenchAngle) => {
  return clenchAngle !== undefined ? (Math.min(Math.max(clenchAngle, MIN_CLANCH_ANGLE), MAX_CLANCH_ANGLE) - MIN_CLANCH_ANGLE) / (MAX_CLANCH_ANGLE - MIN_CLANCH_ANGLE) : undefined;
}

const detectClenchOneAnglePerFinger = (hands) => {
  if (!hands) {
    return;
  }
  const [keypoints3DLeft, keypoints3DRight] =
      getCorrectedHandWorldLandmarks(hands);

  let anyClench = 0;
  clenchRight = false;
  clenchLeft = false;

  if (keypoints3DRight) {    
    const angleIndexRight = angleBetween3DCoords(
      keypoints3DRight[5],
      keypoints3DRight[6],
      keypoints3DRight[7],
    );
    const angleMiddleRight = angleBetween3DCoords(
      keypoints3DRight[9],
      keypoints3DRight[10],
      keypoints3DRight[11],
    );
    const angleRingRight = angleBetween3DCoords(
      keypoints3DRight[13],
      keypoints3DRight[14],
      keypoints3DRight[15],
    );
    const anglePinkRight = angleBetween3DCoords(
      keypoints3DRight[17],
      keypoints3DRight[18],
      keypoints3DRight[19],
    );

    meanAngleRight =
      (angleIndexRight + angleMiddleRight + angleRingRight + anglePinkRight) /
      4;

    clenchRight = meanAngleRight < ClenchMeanAngleThreshholdOneAnglePerFinger ? true : false;
    anyClench = anyClench + (clenchRight ? 1 : 0);
  }

  if (keypoints3DLeft) {
    const angleIndexLeft = angleBetween3DCoords(
      keypoints3DLeft[5],
      keypoints3DLeft[6],
      keypoints3DLeft[7],
    );
    const angleMiddleLeft = angleBetween3DCoords(
      keypoints3DLeft[9],
      keypoints3DLeft[10],
      keypoints3DLeft[11],
    );
    const angleRingLeft = angleBetween3DCoords(
      keypoints3DLeft[13],
      keypoints3DLeft[14],
      keypoints3DLeft[15],
    );
    const anglePinkLeft = angleBetween3DCoords(
      keypoints3DLeft[17],
      keypoints3DLeft[18],
      keypoints3DLeft[19],
    );

    meanAngleLeft =
      (angleIndexLeft + angleMiddleLeft + angleRingLeft + anglePinkLeft) / 4;
    clenchLeft = meanAngleLeft < ClenchMeanAngleThreshholdOneAnglePerFinger ? true : false;
    anyClench = anyClench + (clenchLeft ? 1 : 0);
  }
  return {
    clench: anyClench,
    isClenchLeft: clenchLeft,
    isClenchRight: clenchRight,
    meanClenchAngleRight: meanAngleRight,
    meanClenchAngleLeft: meanAngleLeft,
  };
};


export const detectClench = detectClenchMultipleAnglesMoreFingers;
