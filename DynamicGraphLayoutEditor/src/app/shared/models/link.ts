import { SimulationLinkDatum } from 'd3';
import { GraphicsGML, Position } from './position';
import { NodeGraphData } from './node';

export interface LinkRaw {
   source: string;
   target: string;
   start: number;
   end: number;
   location: string;
}

export interface LinkGML {
   source: string;
   target: string;
   graphics: GraphicsGML | null;
}

export interface LinkData {
   id: number;
   sourceNodeId: number;
   targetNodeId: number;
   startTime: Date;
   endTime: Date;
   locationId: number;
}

export interface LinkGraphData extends SimulationLinkDatum<NodeGraphData> {
   id: number;
   source: NodeGraphData;
   target: NodeGraphData;
   locationId: number;
}

export interface LinkHistory {
   linkId: number;
   startPosition: Position;
   endPosition: Position;
   frame: number;
   locationId: number;
   sourceNodeId: number;
   targetNodeId: number;
}
