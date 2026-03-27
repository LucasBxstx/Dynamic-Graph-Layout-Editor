import { LinkData, LinkGML, LinkGraphData } from './link';
import { LocationData } from './location';
import { NodeData, NodeGML, NodeGraphData } from './node';
import { StateData } from './state';

export interface NetworkGraphData {
   nodes: NodeGraphData[];
   links: LinkGraphData[];
}

export interface DynamicNetworkData {
   startTime: Date;
   endTime: Date;
   nodes: NodeData[];
   links: LinkData[];
   states: StateData[];
   locations: LocationData[];
}

export interface TemporalNetworkGMLData {
   sliceNumber: number; // We get from MultiDynNos a number of slices. This variable stores the number of this Object's slice
   nodes: NodeGML[];
   links: LinkGML[];
}

export interface TemporalNetworkGraphData {
   time: number;
   nodes: NodeGraphData[];
   links: LinkGraphData[];
}
