import { KeyframeBlock, PositionKeyframe } from './keyframe';
import { GraphicsGML, Position, PositionWithFrame } from './position';
import { SimulationNodeDatum } from 'd3';

export interface NodeGML {
   id: string;
   graphics: GraphicsGML;
}

export interface NodeData {
   id: number;
   name: string;
   positionKeyframes: PositionKeyframe[];
   statusKeyframes: KeyframeBlock[];
}

export interface NodeGraphData extends SimulationNodeDatum {
   id: number;
   name: string;
   x: number;
   y: number;
   referenceStateId: number;
   referenceLocationId: number;
   isIsolated: boolean;
}

export interface NodeDraft {
   name: string;
}

export interface NodeHistoryPath {
   nodeId: number;
   referenceStateId: number;
   historyPoints: PositionWithFrame[];
}

export interface NodeFuturePoint {
   nodeId: number;
   frame: number;
   futurePoint: Position;
   opacity: number;
   radius: number;
}
