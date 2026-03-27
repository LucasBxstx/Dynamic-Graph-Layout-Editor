import { Position } from './position';

export type KeyFrameBlockType = 'state' | 'link-duration';
export type EdgeType = 'start' | 'end';

export interface KeyframeBlock {
   id: number;
   type: KeyFrameBlockType;
   referenceId: number;
   starFrame: number;
   endFrame: number;
}

export interface KeyframeBlockGraphData {
   id: number;
   type: KeyFrameBlockType;
   referenceId: number;
   startFrame: number;
   endFrame: number;
   xStart: number;
   xEnd: number;
   y: number;
}

export interface KeyframeBlockEdgeGraphData {
   keyframeBlockId: number;
   blockType: KeyFrameBlockType;
   referenceId: number;
   edgeType: EdgeType;
   frame: number;
   x: number;
   y: number;
}

export interface PositionKeyframe {
   frame: number;
   position: Position;
}

export interface KeyframeGraphData {
   frame: number;
   x: number;
   y: number;
   allNodesHaveThisKeyframe: boolean;
}
