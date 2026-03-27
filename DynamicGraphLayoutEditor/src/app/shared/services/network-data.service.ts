import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable, of, switchMap, take } from 'rxjs';
import { DynamicNetworkData, TemporalNetworkGMLData, TemporalNetworkGraphData } from '../models/network-data';
import { NodeData, NodeDraft, NodeFuturePoint, NodeGraphData, NodeHistoryPath } from '../models/node';
import { Position, PositionWithFrame } from '../models/position';
import { LinkData, LinkGraphData, LinkHistory, LinkRaw } from '../models/link';
import { ProjectSettings } from '../models/project-settings';
import { LocationData } from '../models/location';
import { getDefaultLocationColors, getDefaultStatusColors } from '../utils/network-data-utils';
import { InfectionRawData } from '../models/state';
import { KeyframeBlock, PositionKeyframe } from '../models/keyframe';
import { EventPoint } from '../models/time-line-event';
import { HEALTH_STATE_CARRIER, HEALTH_STATE_DISEASED, HEALTH_STATE_UNDEFINED, LOCATION_UNDEFINED } from '../colors';
import { NODE_FUTURE_POINT_BIG_RADIUS, NODE_FUTURE_POINT_SMALL_RADIUS } from '../sizes';

@Injectable({
   providedIn: 'root'
})
export class NetworkDataService {
   private nodeIdIndex = 0;
   private linkIdIndex = 0;
   private locationIdIndex = 0;
   private statusIdIndex = 0;

   private isFirstLayout = false;

   private currentPointInTime: BehaviorSubject<number> = new BehaviorSubject<number>(0);
   public currentPointInTime$: Observable<number> = this.currentPointInTime.asObservable();

   private readonly networkData: BehaviorSubject<DynamicNetworkData> = new BehaviorSubject<DynamicNetworkData>({
      nodes: [],
      links: [],
      states: [],
      locations: [],
      startTime: new Date(),
      endTime: new Date()
   });

   private readonly projectSettings: BehaviorSubject<ProjectSettings> = new BehaviorSubject<ProjectSettings>({
      projectTitle: '',
      animationTimeForOneDay: 0,
      totalAnimationDuration: 0,
      framesPerSecond: 0,
      totalFrames: 0
   });

   public readonly projectSettings$: Observable<ProjectSettings> = this.projectSettings.asObservable();

   public readonly networkData$: Observable<DynamicNetworkData> = this.networkData.asObservable();

   private readonly versionControl: BehaviorSubject<DynamicNetworkData[]> = new BehaviorSubject<DynamicNetworkData[]>(
      []
   );

   public readonly canRevertLastChange$: Observable<boolean> = this.versionControl.pipe(
      map(versionControl => versionControl.length > 1)
   );

   private readonly renderedGraphData$: Observable<TemporalNetworkGraphData[]> = this.networkData$.pipe(
      map((dynamicNetworkData: DynamicNetworkData) => {
         const renderedGraphData = this.calculateRenderedGraphData(dynamicNetworkData);
         if (this.isFirstLayout) {
            this.initialGraphLayout.next(renderedGraphData);
            this.isFirstLayout = false;
            this.setObjectIdIndices(dynamicNetworkData);
         }

         return renderedGraphData;
      })
   );

   public readonly numberOfRenderedTimeSteps$: Observable<number> = this.renderedGraphData$.pipe(
      map(data => data.length)
   );

   public readonly currentNetworkGraphData$: Observable<TemporalNetworkGraphData> = combineLatest([
      this.currentPointInTime$,
      this.renderedGraphData$
   ]).pipe(
      map(([ currentPointInTime, graphData ]) => {
         return graphData[currentPointInTime];
      })
   );

   private readonly initialGraphLayout = new BehaviorSubject<TemporalNetworkGraphData[]>([]);

   public readonly currentInitialNetworkData$: Observable<TemporalNetworkGraphData> = combineLatest([
      this.initialGraphLayout,
      this.currentPointInTime$
   ]).pipe(
      map(([ initialGraphLayout, currentPointInTime ]) => {
         return initialGraphLayout[currentPointInTime];
      })
   );

   private readonly allNodePaths$: Observable<NodeHistoryPath[]> = this.networkData$.pipe(
      switchMap(networkData => this.getAllNodePaths(networkData))
   );

   public readonly nodeHistoryPaths$: Observable<NodeHistoryPath[]> = combineLatest([
      this.allNodePaths$,
      this.currentPointInTime$
   ]).pipe(
      map(([ allNodePaths, currentPointInTime ]) => this.getCurrentNodeHistoryPath(allNodePaths, currentPointInTime))
   );

   private readonly filteredNodePoints$: Observable<NodeFuturePoint[]> = this.networkData$.pipe(
      switchMap(() => this.getNodeFuturePoints())
   );

   public readonly nodeFuturePoints$: Observable<NodeFuturePoint[]> = combineLatest([
      this.filteredNodePoints$,
      this.currentPointInTime$
   ]).pipe(
      map(([ filteredNodePoints, currentPointInTime ]) =>
         this.getCurrentNodeFuturePoints(currentPointInTime, filteredNodePoints)
      )
   );

   private readonly allRenderedLinks$: Observable<LinkHistory[]> = this.networkData$.pipe(
      switchMap(() => this.getAllRenderedLinks())
   );

   public readonly linkHistory$: Observable<LinkHistory[]> = combineLatest([
      this.allRenderedLinks$,
      this.currentPointInTime$
   ]).pipe(map(([ renderedLinks, currentPointInTime ]) => renderedLinks.filter(link => link.frame < currentPointInTime)));

   public readonly timeLineStatusEvents$: Observable<EventPoint[]> = this.networkData.pipe(
      map(networkData => {
         const eventPoints: EventPoint[] = [];
         let eventPointId = 0;
         networkData.nodes.forEach(node => {
            node.statusKeyframes.forEach(keyframeBlock => {
               if (keyframeBlock.starFrame >= this.getFrameForAccordingDate(new Date(networkData.endTime))) {
                  return;
               }

               eventPoints.push({
                  id: ++eventPointId,
                  referenceId: keyframeBlock.referenceId,
                  frame: keyframeBlock.starFrame
               });
            });
         });

         return eventPoints;
      })
   );

   public readonly timeLineContactEvents$: Observable<EventPoint[]> = this.networkData$.pipe(
      map(networkData => {
         const eventPoints: EventPoint[] = [];
         let eventPointId = 0;
         networkData.links.forEach(link => {
            eventPoints.push({
               id: ++eventPointId,
               referenceId: link.locationId,
               frame: this.getFrameForAccordingDate(link.startTime)
            });
         });

         return eventPoints;
      })
   );

   private selectedNodeIds: BehaviorSubject<number[]> = new BehaviorSubject<number[]>([]);
   public selectedNodeIds$: Observable<number[]> = this.selectedNodeIds.asObservable();

   private selectedLinkIds: BehaviorSubject<number[]> = new BehaviorSubject<number[]>([]);
   public selectedLinkIds$: Observable<number[]> = this.selectedLinkIds.asObservable();

   public affectedLinkIds$: Observable<number[]> = combineLatest([ this.selectedNodeIds$, this.networkData$ ]).pipe(
      map(([ selectedNodeIds, networkData ]) =>
         networkData.links
            .filter(link => selectedNodeIds.includes(link.sourceNodeId) || selectedNodeIds.includes(link.targetNodeId))
            .map(link => link.id)
      )
   );

   public affectedNodeIds$: Observable<number[]> = combineLatest([ this.selectedLinkIds$, this.networkData$ ]).pipe(
      map(([ selectedLinkIds, networkData ]) => {
         const selectedLinks = networkData.links.filter(link => selectedLinkIds.includes(link.id));
         const affectedLinks: number[] = [];
         selectedLinks.forEach(link => {
            if (!affectedLinks.includes(link.sourceNodeId)) {
               affectedLinks.push(link.sourceNodeId);
            }
            if (!affectedLinks.includes(link.targetNodeId)) {
               affectedLinks.push(link.targetNodeId);
            }
         });
         return affectedLinks;
      })
   );

   // Each number represents the timepoint of a keyframe of the currently selected node
   public currentNodeKeyFrames$: Observable<number[]> = combineLatest([ this.networkData$, this.selectedNodeIds$ ]).pipe(
      map(([ networkData, selectedNodeIds ]) => {
         const selectedNodes = networkData.nodes.filter(node => selectedNodeIds.includes(node.id));
         const keyFrames: number[] = [];

         selectedNodes.forEach(node => {
            node.positionKeyframes.forEach(keyframe => keyFrames.push(keyframe.frame));
         });

         return keyFrames;
      })
   );

   public currentLinkDurationKeyFrameBlock$: Observable<KeyframeBlock[]> = combineLatest([
      this.networkData$,
      this.selectedLinkIds$
   ]).pipe(
      map(([ networkData, selectedLinkIds ]) => {
         const selectedLinks = networkData.links.filter(link => selectedLinkIds.includes(link.id));
         const selectedLink = selectedLinks[0];
         if (!selectedLink) {
            return [];
         }

         return [
            {
               id: 1,
               type: 'link-duration',
               referenceId: selectedLink.id,
               starFrame: this.getFrameForAccordingDate(selectedLink.startTime),
               endFrame: this.getFrameForAccordingDate(selectedLink.endTime)
            }
         ];
      })
   );

   public currentHealthStatusKeyFrameBlocks$: Observable<KeyframeBlock[]> = combineLatest([
      this.networkData$,
      this.selectedNodeIds$
   ]).pipe(
      map(([ networkData, selectedNodeIds ]) => {
         if (selectedNodeIds.length !== 1) {
            return [];
         }

         const selectedNode = networkData.nodes.find(node => node.id === selectedNodeIds[0]);
         if (!selectedNode) {
            return [];
         }

         return [ ...selectedNode.statusKeyframes ];
      })
   );

   // Entails the timepoints of keyframes that are currently selected by the user to be edited
   private readonly currentSelectedEditingKeyFrames = new BehaviorSubject<number[]>([]);
   public readonly currentSelectedEditingKeyFrames$: Observable<number[]> =
      this.currentSelectedEditingKeyFrames.asObservable();

   // Entails the ids of keyframes that are currently selected by the user to be edited
   private readonly currentSelectedKeyframeBlocks = new BehaviorSubject<number[]>([]);
   public readonly currentSelectedKeyframeBlocks$: Observable<number[]> =
      this.currentSelectedKeyframeBlocks.asObservable();

   private readonly nodeWaitingToBePlaced: BehaviorSubject<NodeDraft | null> = new BehaviorSubject<NodeDraft | null>(
      null
   );
   public readonly nodeWaitingToBePlaced$: Observable<NodeDraft | null> = this.nodeWaitingToBePlaced.asObservable();

   //// Functions
   // Creation of the network
   public openProject (
      projectSettings: ProjectSettings,
      networkData: DynamicNetworkData,
      initialNetworkData: TemporalNetworkGraphData[]
   ): void {
      // clear all variables that were used before if the user opens a new project
      this.clearAllVariables();

      // All data that include timestemps or datetimes need to be parsed to real datetime objects again
      const LinkData: LinkData[] = networkData.links.map(link => ({
         id: link.id,
         sourceNodeId: link.sourceNodeId,
         targetNodeId: link.targetNodeId,
         startTime: new Date(link.startTime),
         endTime: new Date(link.endTime),
         locationId: link.locationId
      }));

      networkData.links = LinkData;

      this.projectSettings.next(projectSettings);
      this.versionControl.next([ networkData ]);
      this.networkData.next(networkData);
      this.initialGraphLayout.next(initialNetworkData);

      this.setObjectIdIndices(networkData);
   }

   private setObjectIdIndices (networkData: DynamicNetworkData): void {
      let highestNodeId = 0;
      let highestLinkId = 0;
      let highestStateId = 0;
      let highestLocationId = 0;

      if (networkData.nodes.length > 0) {
         highestNodeId = networkData.nodes.reduce((max, node) => (node.id > max.id ? node : max)).id;
      }
      if (networkData.links.length > 0) {
         highestLinkId = networkData.links.reduce((max, link) => (link.id > max.id ? link : max)).id;
      }
      if (networkData.states.length > 0) {
         highestStateId = networkData.states.reduce((max, state) => (state.id > max.id ? state : max)).id;
      }
      if (networkData.locations.length > 0) {
         highestLocationId = networkData.locations.reduce((max, location) =>
            location.id > max.id ? location : max
         ).id;
      }

      this.nodeIdIndex = highestNodeId;
      this.linkIdIndex = highestLinkId;
      this.statusIdIndex = highestStateId;
      this.locationIdIndex = highestLocationId;
   }

   public createNewNetworkFromImportDataset (networkData: DynamicNetworkData, projectTitle: string): void {
      this.clearAllVariables();

      this.setNewDynamicNetworkData(networkData);

      const startTime = new Date(networkData.startTime);
      const endTime = new Date(networkData.endTime);
      const timeSpanInMS = Math.abs(endTime.getTime() - startTime.getTime());
      const timeSpanInDays = timeSpanInMS / (1000 * 60 * 60 * 24);
      const totalAnimationDuration = 30;
      const animationTimeForOneDay = Math.round((totalAnimationDuration / timeSpanInDays) * 100) / 100;
      const framesPerSecond = 24;
      const totalFrames = totalAnimationDuration * framesPerSecond;

      this.projectSettings.next({
         projectTitle,
         animationTimeForOneDay,
         totalAnimationDuration,
         framesPerSecond,
         totalFrames
      });
   }

   public createNewNetwork (projectSettings: ProjectSettings, startTime: Date, endTime: Date): void {
      this.clearAllVariables();

      this.projectSettings.next(projectSettings);

      const networkData: DynamicNetworkData = {
         nodes: [],
         links: [],
         states: [
            {
               id: ++this.statusIdIndex,
               name: 'undefined',
               color: HEALTH_STATE_UNDEFINED
            }
         ],
         locations: [
            {
               id: ++this.locationIdIndex,
               name: 'undefined',
               color: LOCATION_UNDEFINED
            }
         ],
         startTime,
         endTime
      };

      this.setNewDynamicNetworkData(networkData);
   }

   public mergeInfectionDataIntoNetworkData (newNetworkData: DynamicNetworkData): void {
      this.setNewDynamicNetworkData(newNetworkData);
      this.versionControl.next([ newNetworkData ]);
   }

   public mergeMultiDynNosDataIntoNetworkData (networkData: TemporalNetworkGMLData[]): void {
      const dynamicNetworkData = this.addMultiDynNosPositionsToNetwork(networkData);
      this.setNewDynamicNetworkData(dynamicNetworkData);
      this.versionControl.next([ dynamicNetworkData ]);
      this.isFirstLayout = true;
   }

   private clearAllVariables (): void {
      this.selectedNodeIds.next([]);
      this.selectedLinkIds.next([]);
      this.nodeWaitingToBePlaced.next(null);
      this.currentSelectedEditingKeyFrames.next([]);
      this.initialGraphLayout.next([]);

      this.nodeIdIndex = 0;
      this.linkIdIndex = 0;
      this.statusIdIndex = 0;
      this.locationIdIndex = 0;
   }

   public updateProjectSettings (projectSettings: ProjectSettings): void {
      this.projectSettings.next(projectSettings);
   }

   private setNewDynamicNetworkData (dynamicNetworkData: DynamicNetworkData): void {
      this.updateNetworkData(dynamicNetworkData);
   }

   private updateNetworkData (networkData: DynamicNetworkData): void {
      const currentVersionControl = [ ...this.versionControl.getValue() ];
      const clonedNetworkData = structuredClone(networkData);

      currentVersionControl.push(clonedNetworkData);
      this.versionControl.next(currentVersionControl);
      this.networkData.next(clonedNetworkData);
   }

   public revertLastChange (): void {
      const versionControl = [ ...this.versionControl.getValue() ];
      if (versionControl.length > 1) {
         versionControl.pop();
         const updatedNetworkData = structuredClone(versionControl[versionControl.length - 1]);
         this.versionControl.next(versionControl);
         this.networkData.next(updatedNetworkData);
      }
   }

   private addMultiDynNosPositionsToNetwork (multiDynNosData: TemporalNetworkGMLData[]): DynamicNetworkData {
      const networkData = structuredClone(this.networkData.getValue());
      const projectSettings = this.projectSettings.getValue();
      const intervalLength = projectSettings.totalFrames / multiDynNosData.length;

      multiDynNosData.forEach(timeSlice => {
         timeSlice.nodes.forEach(node => {
            const cleanedNodeName = node.id.match(/^\d+/)?.[0] || '';
            const correspondingNode = networkData.nodes.find(existingNode => existingNode.name === cleanedNodeName);

            if (!correspondingNode) {
               return;
            }

            correspondingNode.positionKeyframes.push({
               frame: intervalLength * timeSlice.sliceNumber,
               position: {
                  x: node.graphics.x,
                  y: node.graphics.y
               }
            });
         });
      });

      return networkData;
   }

   // Time related operations
   public setTimePoint (timepoint: number, holdControl: boolean = false): void {
      this.currentPointInTime.next(timepoint);

      // Every time we set a new timepoint (through clicking on a keyframe / moving the slider / clicking on a timepoint) we need to update the currentSelectedKeyFrames
      // this.maybeSelectPositionKeyframe(timepoint, holdControl);
   }

   public selectPositionKeyframe (timepoint: number, holdControl: boolean = false): void {
      this.currentPointInTime.next(timepoint);
      this.onKeyFramesSelect([ timepoint ], holdControl);
   }

   public previousTimeStep (): void {
      const currentIndex = this.currentPointInTime.getValue();

      if (currentIndex > 0) {
         this.currentPointInTime.next(currentIndex - 1);
         // Every time we set a new timepoint we need to update the currentSelectedKeyFrames
         // this.maybeSelectPositionKeyframe(currentIndex - 1);
      }
   }

   public nextTimeStep (): void {
      const currentIndex = this.currentPointInTime.getValue();
      const dataLength = structuredClone(this.projectSettings.getValue()).totalFrames;

      if (currentIndex < dataLength - 1) {
         this.currentPointInTime.next(currentIndex + 1);
         // Every time we set a new timepoint we need to update the currentSelectedKeyFrames
         // this.maybeSelectPositionKeyframe(currentIndex + 1);
      }
   }

   private maybeSelectPositionKeyframe (timepoint: number, holdControl: boolean = false): void {
      const selectedNodeIds = this.selectedNodeIds.getValue();
      const nodes = structuredClone(this.networkData.getValue()).nodes;
      const selectedNodes = nodes.filter(node => selectedNodeIds.includes(node.id));
      const anySelectedNodeHasKeyframesAtThisFrame = selectedNodes.some(node =>
         node.positionKeyframes.some(k => k.frame === timepoint)
      );

      if (selectedNodeIds.length === 0) {
         if (anySelectedNodeHasKeyframesAtThisFrame) {
            this.onKeyFramesSelect([ timepoint ], holdControl);
         }
      }
   }

   public firstTimeStep (): void {
      this.currentPointInTime.next(0);
      // Every time we set a new timepoint we need to update the currentSelectedKeyFrames
      // this.onKeyFramesSelect([ 0 ]);
   }

   public lastTimeStep (): void {
      const dataLength = structuredClone(this.projectSettings.getValue()).totalFrames;
      this.currentPointInTime.next(dataLength - 1);
      // Every time we set a new timepoint we need to update the currentSelectedKeyFrames
      // this.onKeyFramesSelect([ dataLength - 1 ]);
   }

   // Node and Link operations

   public deselectNodesAndLinks (): void {
      this.clearSelectedNodes();
      this.clearSelectedLinks();
   }

   public onNodeClicked (nodeId: number, holdControl: boolean = false): void {
      this.removeAllKeyframesFromSelection();
      const selectedNodes = this.selectedNodeIds.getValue();
      if (selectedNodes.includes(nodeId)) {
         if (holdControl) {
            this.removeNodesFromSelection([ nodeId ]);
         } else {
            this.clearSelectedNodes();
            this.clearSelectedLinks();
         }
      } else {
         if (holdControl) {
            this.addNodeToSelection(nodeId);
         } else {
            this.setNewSelectedNodes([ nodeId ]);
            this.clearSelectedLinks();
         }
      }
   }

   public onLinkClicked (linkId: number, holdControl: boolean = false): void {
      this.clearKeyFrameBlockSelection();
      const selectedLinks = this.selectedLinkIds.getValue();
      if (selectedLinks.includes(linkId)) {
         if (holdControl) {
            this.removeLinksFromSelection([ linkId ]);
         } else {
            this.clearSelectedLinks();
            this.clearSelectedNodes();
         }
      } else {
         if (holdControl) {
            this.addLinkToSelection(linkId);
         } else {
            this.setNewSelectedLinks([ linkId ]);
            this.clearSelectedNodes();
         }
      }
   }

   public onRectangleNodeSelect (selectedNodeIds: number[]): void {
      selectedNodeIds.forEach(nodeId => this.onNodeClicked(nodeId, true));
   }

   public onRectangleLinkSelect (selectedLinkIds: number[]): void {
      selectedLinkIds.forEach(linkId => this.onLinkClicked(linkId, true));
   }

   private setNewSelectedNodes (nodeIds: number[]): void {
      this.selectedNodeIds.next([ ...nodeIds ]);
      this.selectedLinkIds.next([]);
   }

   private setNewSelectedLinks (linkIds: number[]): void {
      this.selectedLinkIds.next([ ...linkIds ]);
      this.selectedNodeIds.next([]);
   }

   private addNodeToSelection (nodeId: number): void {
      const selectedNodes = this.selectedNodeIds.getValue();
      const nodeAlreadyInSelection = selectedNodes.findIndex(id => id === nodeId) >= 0;

      if (!nodeAlreadyInSelection) {
         selectedNodes.push(nodeId);
         this.selectedNodeIds.next([ ...selectedNodes ]);
      }
   }

   private addLinkToSelection (linkId: number): void {
      const selectedLinks = this.selectedLinkIds.getValue();
      const linkAlreadyInSelection = selectedLinks.findIndex(id => id === linkId) >= 0;

      if (!linkAlreadyInSelection) {
         selectedLinks.push(linkId);
         this.selectedLinkIds.next([ ...selectedLinks ]);
      }
   }

   private removeNodesFromSelection (excludingNodeIds: number[]): void {
      const selectedNodes = this.selectedNodeIds.getValue();
      const filteredNodes = selectedNodes.filter(nodeId => !excludingNodeIds.includes(nodeId));
      this.selectedNodeIds.next([ ...filteredNodes ]);
   }

   private removeLinksFromSelection (excludingLinkIds: number[]): void {
      const selectedlinks = this.selectedLinkIds.getValue();
      const filteredLinks = selectedlinks.filter(linkId => !excludingLinkIds.includes(linkId));
      this.selectedLinkIds.next([ ...filteredLinks ]);
   }

   private clearSelectedNodes (): void {
      this.selectedNodeIds.next([]);
   }

   private clearSelectedLinks (): void {
      this.selectedLinkIds.next([]);
   }

   public addNodeToWaitingList (nodeDraft: NodeDraft): void {
      this.nodeWaitingToBePlaced.next(nodeDraft);
   }

   public removeNodeFromWaitingList (): void {
      this.nodeWaitingToBePlaced.next(null);
   }

   public moveSelectedNodes (offset: [number, number]): void {
      const [ xOffset, yOffset ] = offset;
      const networkData = structuredClone(this.networkData.getValue());
      const currentPointInTime = this.currentPointInTime.getValue();
      const selectedNodeIds = this.selectedNodeIds.getValue();
      const selectedKeyFrames = this.currentSelectedEditingKeyFrames.getValue();
      this.renderedGraphData$.pipe(take(1)).subscribe(renderedGraphData => {
         networkData.nodes.forEach(node => {
            if (!selectedNodeIds.includes(node.id)) {
               return;
            }

            const renderedNode: NodeGraphData | undefined = renderedGraphData[currentPointInTime].nodes.find(
               renderedNode => renderedNode.id === node.id
            );

            let firstKeyFramePosition: Position;

            selectedKeyFrames.forEach((timePoint, index) => {
               const hasKeyFrameAtThisTimePoint =
                  node.positionKeyframes.findIndex(keyFrame => keyFrame.frame === timePoint) >= 0;
               if (!hasKeyFrameAtThisTimePoint && renderedNode) {
                  // For those nodes that dont have a keyframe yet but some other have, we create a new keyframe with the interpolated position with the added offset

                  if (index === 0) {
                     firstKeyFramePosition = {
                        x: renderedNode.x - xOffset,
                        y: renderedNode.y - yOffset
                     };
                  }

                  node.positionKeyframes.push({
                     frame: timePoint,
                     position: firstKeyFramePosition
                  });
               } else {
                  // In case the node already has a keyframe, we can just update the position
                  const keyFrame = node.positionKeyframes.find(keyFrame => keyFrame.frame === timePoint);

                  if (index === 0) {
                     const xOld = keyFrame!.position.x;
                     const yOld = keyFrame!.position.y;

                     firstKeyFramePosition = {
                        x: xOld - xOffset,
                        y: yOld - yOffset
                     };
                  }

                  keyFrame!.position = firstKeyFramePosition;
               }
            });

            // For those nodes that dont have a keyframe at the current position yet,
            // we create a new keyframe with the interpolated position with the added offset
            if (!node.positionKeyframes.find(keyframe => keyframe.frame === currentPointInTime)) {
               const renderedNode: NodeGraphData | undefined = renderedGraphData[currentPointInTime].nodes.find(
                  renderedNode => renderedNode.id === node.id
               );

               if (renderedNode) {
                  node.positionKeyframes.push({
                     frame: currentPointInTime,
                     position: {
                        x: renderedNode.x - xOffset,
                        y: renderedNode.y - yOffset
                     }
                  });
               }

               selectedKeyFrames.push(currentPointInTime);
            }
         });

         this.updateNetworkData(networkData);
      });
   }

   public addNode (name: string, position: Position) {
      const networkData = structuredClone(this.networkData.getValue());

      networkData.nodes.push({
         id: ++this.nodeIdIndex,
         name,
         positionKeyframes: [
            {
               frame: 0,
               position
            }
         ],
         statusKeyframes: []
      });

      this.updateNetworkData({ ...networkData });
   }

   public addLink (): void {
      const networkData = structuredClone(this.networkData.getValue());
      const projectSettings = structuredClone(this.projectSettings.getValue());
      const selectedNodeIds = this.selectedNodeIds.getValue();
      const selectedNodes = networkData.nodes.filter(node => selectedNodeIds.includes(node.id));
      const startFrame = this.currentPointInTime.getValue();
      const startTime = this.getFrameStartAndEndTime(startFrame).frameStartTime;
      const defaultDuration = projectSettings.totalFrames / 10;
      const endFrame = Math.min(
         startFrame + defaultDuration,
         this.getFrameForAccordingDate(new Date(networkData.endTime))
      );
      const endTime = this.getFrameStartAndEndTime(endFrame).frameEndTime;

      const newLinkIds: number[] = [];
      for (let i = 0; i < selectedNodeIds.length; i++) {
         for (let j = i + 1; j < selectedNodeIds.length; j++) {
            const newLinkId = ++this.linkIdIndex;
            newLinkIds.push(newLinkId);

            networkData.links.push({
               id: newLinkId,
               sourceNodeId: selectedNodes[i].id,
               targetNodeId: selectedNodes[j].id,
               startTime,
               endTime,
               locationId: 1
            });
         }
      }

      this.updateNetworkData({ ...networkData });
      this.clearSelectedNodes();
      this.setNewSelectedLinks(newLinkIds);
      this.setNewKeyFrameBlockSelection(1);
   }

   // Delete the selected Nodes and links and all affectedLinks
   public deleteSelectedObjects (): void {
      const networkData = structuredClone(this.networkData.getValue());

      combineLatest([ this.selectedNodeIds$, this.selectedLinkIds$, this.affectedLinkIds$ ])
         .pipe(take(1))
         .subscribe(([ selectedNodeIds, selectedLinkIds, affectedLinkIds ]) => {
            const filteredNodes = networkData.nodes.filter(node => !selectedNodeIds.includes(node.id));
            const filteredLinks = networkData.links.filter(
               link => !selectedLinkIds.includes(link.id) && !affectedLinkIds.includes(link.id)
            );

            networkData.nodes = filteredNodes;
            networkData.links = filteredLinks;

            this.updateNetworkData({ ...networkData });
            this.clearSelectedNodes();
            this.clearSelectedLinks();
         });
   }

   // Keyframes

   public resetAllSelectedKeyframes (): void {
      this.currentSelectedEditingKeyFrames.next([]);
      this.currentSelectedKeyframeBlocks.next([]);
   }

   public onKeyFramesSelect (selectedTimePoints: number[], holdControl: boolean = false): void {
      const selectedKeyFrames = this.currentSelectedEditingKeyFrames.getValue();
      selectedTimePoints.forEach(timePoint => {
         if (selectedKeyFrames.includes(timePoint)) {
            if (holdControl) {
               this.removeKeyFrameFromSelection(timePoint);
            } else {
               this.setNewKeyFrameSelection(timePoint); // deselect all keyframes except this one
            }
         } else {
            if (holdControl) {
               this.addToSelectedKeyFrames(timePoint);
            } else {
               this.setNewKeyFrameSelection(timePoint);
            }
         }
      });
   }

   private removeAllKeyframesFromSelection (): void {
      this.currentSelectedEditingKeyFrames.next([]);
   }
   private setNewKeyFrameSelection (timePoint: number): void {
      this.currentSelectedEditingKeyFrames.next([ timePoint ]);
   }

   private addToSelectedKeyFrames (timePoint: number): void {
      const selectedKeyFrames = this.currentSelectedEditingKeyFrames.getValue();

      if (!selectedKeyFrames.includes(timePoint)) {
         const updatedSelection = [ ...selectedKeyFrames, timePoint ];
         this.currentSelectedEditingKeyFrames.next(updatedSelection);
      }
   }

   private removeKeyFrameFromSelection (timePoint: number): void {
      const selectedKeyFrames = this.currentSelectedEditingKeyFrames.getValue();
      const filteredKeyFrames = selectedKeyFrames.filter(keyframe => keyframe !== timePoint);
      this.currentSelectedEditingKeyFrames.next(filteredKeyFrames);
   }

   public addPositionKeyFrameAtCurrentTimePoint (): void {
      const currentPointInTime = this.currentPointInTime.getValue();
      const networkData = structuredClone(this.networkData.getValue());
      const selectedNodeIds = this.selectedNodeIds.getValue();

      this.renderedGraphData$.pipe(take(1)).subscribe(renderedGraphData => {
         const selectedNodes = networkData.nodes.filter(node => selectedNodeIds.includes(node.id));
         selectedNodes.forEach(node => {
            const nodeAlreadyHasKeyframeAtCurrentPoint = !!node.positionKeyframes.find(
               keyframe => keyframe.frame === currentPointInTime
            );

            if (nodeAlreadyHasKeyframeAtCurrentPoint) {
               return;
            }

            const renderedNode = renderedGraphData[currentPointInTime].nodes.find(index => index.id === node.id);
            const keyFrame: PositionKeyframe = {
               frame: currentPointInTime,
               position: {
                  x: renderedNode!.x ?? 0,
                  y: renderedNode!.y ?? 0
               }
            };

            node.positionKeyframes.push(keyFrame);
         });

         this.updateNetworkData({ ...networkData });
         this.addToSelectedKeyFrames(currentPointInTime);
      });
   }

   public addNodeStatusKeyframeBlock (statusId: number): void {
      const networkData = structuredClone(this.networkData.getValue());
      const selectedNodeIds = this.selectedNodeIds.getValue();
      const selectedNodes = networkData.nodes.filter(node => selectedNodeIds.includes(node.id));
      if (selectedNodes.length === 0) {
         return;
      }

      const node = selectedNodes[0];
      const index = node.statusKeyframes.length - 1;
      const lastId: number = index === -1 ? 0 : node.statusKeyframes[index].id;
      const projectSettings = structuredClone(this.projectSettings.getValue());
      const starFrame = this.currentPointInTime.getValue();
      const defaultDuration = projectSettings.totalFrames / 10;
      const lastFrame = this.getFrameForAccordingDate(new Date(networkData.endTime));

      this.currentHealthStatusKeyFrameBlocks$.pipe(take(1)).subscribe(kbs => {
         const kbsAfterStartFrame = kbs.filter(kb => kb.starFrame > starFrame);
         const blockingFrame =
            kbsAfterStartFrame.length === 0
               ? lastFrame
               : kbsAfterStartFrame.reduce((kb, min) => (kb.starFrame < min.starFrame ? kb : min)).starFrame;

         const endFrame = Math.min(starFrame + defaultDuration, blockingFrame);

         node.statusKeyframes.push({
            id: lastId + 1,
            type: 'state',
            referenceId: statusId,
            starFrame,
            endFrame
         });

         this.updateNetworkData({ ...networkData });
         this.addToSelectedKeyFrameBlocks(lastId + 1);
      });
   }

   public deleteSelectedPositionKeyFrames (): void {
      const networkData = structuredClone(this.networkData.getValue());
      const selectedNodeIds = this.selectedNodeIds.getValue();
      const selectedNodes = networkData.nodes.filter(node => selectedNodeIds.includes(node.id));
      const selectedKeyFrames = this.currentSelectedEditingKeyFrames.getValue();
      selectedNodes.forEach(node => {
         const keyFramesThatShouldBeDeleted = node.positionKeyframes.filter(keyframe =>
            selectedKeyFrames.includes(keyframe.frame)
         );
         keyFramesThatShouldBeDeleted.forEach(keyframe => {
            // Delete that keyframe from the array
            const keyframeIndex = node.positionKeyframes.findIndex(index => index.frame === keyframe.frame);
            node.positionKeyframes = node.positionKeyframes
               .slice(0, keyframeIndex)
               .concat(node.positionKeyframes.slice(keyframeIndex + 1));
         });
      });

      this.currentSelectedEditingKeyFrames.next([]);
      this.updateNetworkData(networkData);
   }

   public deleteSelectedKeyframeBlocks (): void {
      const networkData = structuredClone(this.networkData.getValue());
      const selectedNodeIds = this.selectedNodeIds.getValue();
      const selectedNodes = networkData.nodes.filter(node => selectedNodeIds.includes(node.id));
      const selectedKeyframeBlocks = this.currentSelectedKeyframeBlocks.getValue();

      if (selectedNodes.length !== 1) {
         return;
      }

      const nodeToUpdate = selectedNodes[0];

      const filteredKeyframes = nodeToUpdate.statusKeyframes.filter(kb => !selectedKeyframeBlocks.includes(kb.id));
      nodeToUpdate.statusKeyframes = filteredKeyframes;

      this.currentSelectedKeyframeBlocks.next([]);
      this.updateNetworkData(networkData);
   }

   public moveSelectedKeyframes (offset: number): void {
      const selectedKeyframeIds = this.currentSelectedEditingKeyFrames.getValue();
      const networkData = structuredClone(this.networkData.getValue());

      networkData.nodes.forEach(node => {
         const nodeKeyframesThatNeedToBeUpdated = node.positionKeyframes.filter(nodeKF =>
            selectedKeyframeIds.includes(nodeKF.frame)
         );

         nodeKeyframesThatNeedToBeUpdated.forEach(keyframe => {
            keyframe.frame -= offset;
         });
      });

      this.updateNetworkData({ ...networkData });
   }

   // Keyframe Blocks

   public onKeyFrameBlockSelect (id: number, holdControl: boolean = false): void {
      const selectedKeyframeBlocks = this.currentSelectedKeyframeBlocks.getValue();

      if (selectedKeyframeBlocks.includes(id)) {
         if (holdControl) {
            this.removeKeyFrameBlockFromSelection(id);
         } else {
            this.clearKeyFrameBlockSelection();
         }
      } else {
         if (holdControl) {
            this.addToSelectedKeyFrameBlocks(id);
         } else {
            this.setNewKeyFrameBlockSelection(id);
         }
      }
   }

   private clearKeyFrameBlockSelection (): void {
      this.currentSelectedKeyframeBlocks.next([]);
   }

   private setNewKeyFrameBlockSelection (id: number): void {
      this.currentSelectedKeyframeBlocks.next([ id ]);
   }

   private addToSelectedKeyFrameBlocks (id: number): void {
      const selectedKeyFrames = this.currentSelectedKeyframeBlocks.getValue();

      if (!selectedKeyFrames.includes(id)) {
         const updatedSelection = [ ...selectedKeyFrames, id ];
         this.currentSelectedKeyframeBlocks.next(updatedSelection);
      }
   }

   private removeKeyFrameBlockFromSelection (keyframeBlockId: number): void {
      const selectedKeyFrames = this.currentSelectedKeyframeBlocks.getValue();
      const filteredKeyFrames = selectedKeyFrames.filter(id => id !== keyframeBlockId);
      this.currentSelectedKeyframeBlocks.next(filteredKeyFrames);
   }

   public moveSelectedLinkDurationKeyframeBlock (offset: number): void {
      const networkData = structuredClone(this.networkData.getValue());
      const selectedLinkId = this.selectedLinkIds.getValue();
      const selectedLink = networkData.links.find(link => link.id === selectedLinkId[0]);

      if (!selectedLink) {
         return;
      }

      const startFrame = this.getFrameForAccordingDate(selectedLink.startTime);
      const endFrame = this.getFrameForAccordingDate(selectedLink.endTime);
      const newStartFrame = startFrame - offset;
      const newEndFrame = endFrame - offset;

      selectedLink.startTime = this.getFrameStartAndEndTime(newStartFrame).frameEndTime;
      selectedLink.endTime = this.getFrameStartAndEndTime(newEndFrame).frameEndTime;

      this.updateNetworkData({ ...networkData });
      this.currentPointInTime.next(newStartFrame);
   }

   public moveSelectedStatusKeyframeBlocks (offset: number): void {
      const selectedKeyframeblockIds = this.currentSelectedKeyframeBlocks.getValue();
      const networkData = structuredClone(this.networkData.getValue());

      const selectedNodeIds = this.selectedNodeIds.getValue();
      const selectedNodes = networkData.nodes.filter(node => selectedNodeIds.includes(node.id));

      selectedNodes.forEach(node => {
         const statusKeyframeBlocksThatNeedToBeUpdated = node.statusKeyframes.filter(kB =>
            selectedKeyframeblockIds.includes(kB.id)
         );

         statusKeyframeBlocksThatNeedToBeUpdated.forEach(kB => {
            kB.starFrame -= offset;
            kB.endFrame -= offset;
         });
      });

      this.updateNetworkData({ ...networkData });
   }

   public changeLinkDuration (startFrame: number, endFrame: number): void {
      const networkData = structuredClone(this.networkData.getValue());
      const selectedLinkIds = this.selectedLinkIds.getValue();
      const selectedLinks = networkData.links.filter(l => selectedLinkIds.includes(l.id));

      selectedLinks.forEach(link => {
         link.startTime = this.getFrameStartAndEndTime(startFrame).frameStartTime;
         link.endTime = this.getFrameStartAndEndTime(endFrame).frameStartTime;
      });

      this.updateNetworkData({ ...networkData });

      const link = selectedLinks[0];
      if (!link) {
         return;
      }
      const currentFrame = this.currentPointInTime.getValue();
      const linkIsRightFromCursor = this.getFrameForAccordingDate(link.startTime) > currentFrame;
      const linkIsLeftFromCursor = this.getFrameForAccordingDate(link.endTime) < currentFrame;

      if (linkIsRightFromCursor) {
         this.currentPointInTime.next(startFrame);
      }
      if (linkIsLeftFromCursor) {
         this.currentPointInTime.next(endFrame);
      }
   }

   public changeStatusDuration (id: number, startFrame: number, endFrame: number): void {
      const networkData = structuredClone(this.networkData.getValue());
      const selectedNodeIds = this.selectedNodeIds.getValue();
      const node = networkData.nodes.find(node => node.id === selectedNodeIds[0]);

      if (!node) {
         return;
      }

      const keyframeBlock = node.statusKeyframes.find(kb => kb.id === id);
      if (!keyframeBlock) {
         return;
      }

      keyframeBlock.starFrame = startFrame;
      keyframeBlock.endFrame = endFrame;

      this.updateNetworkData({ ...networkData });

      const currentFrame = this.currentPointInTime.getValue();
      const linkIsRightFromCursor = startFrame > currentFrame;
      const linkIsLeftFromCursor = endFrame < currentFrame;

      if (linkIsRightFromCursor) {
         this.currentPointInTime.next(startFrame);
      }
      if (linkIsLeftFromCursor) {
         this.currentPointInTime.next(endFrame);
      }
   }

   // Status
   public addStatus (name: string, color: string): void {
      const networkData = structuredClone(this.networkData.getValue());
      networkData.states.push({
         id: ++this.statusIdIndex,
         name,
         color
      });

      this.updateNetworkData({ ...networkData });
   }

   // Location
   public addLocation (name: string, color: string): void {
      const networkData = structuredClone(this.networkData.getValue());
      networkData.locations.push({
         id: ++this.locationIdIndex,
         name,
         color
      });
      console.log(networkData);

      this.updateNetworkData({ ...networkData });
   }

   public setNewLinkLocation (locationId: number): void {
      const networkData = structuredClone(this.networkData.getValue());
      const selectedLinkIds = this.selectedLinkIds.getValue();
      const selectedLinks = networkData.links.filter(link => selectedLinkIds.includes(link.id));
      selectedLinks.forEach(link => {
         link.locationId = locationId;
      });

      this.updateNetworkData({ ...networkData });
   }

   // File Options

   public saveEditingProgress (): void {
      const networkData = structuredClone(this.networkData.getValue());
      const initialNetworkData = structuredClone(this.initialGraphLayout.getValue());
      const projectSettings = structuredClone(this.projectSettings.getValue());

      const saveObject = {
         projectSettings,
         networkData,
         initialNetworkData
      };

      const json = JSON.stringify(saveObject, null, 2);
      const blob = new Blob([ json ], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = `${projectSettings.projectTitle}.json`;
      a.click();

      URL.revokeObjectURL(url);
   }

   // Converting of Fileimports

   public convertHealthCareDataToNodesAndLinks (parsed: LinkRaw[]): DynamicNetworkData {
      const locationColors = getDefaultLocationColors();
      let locationColorIndex = 0;
      const nodes: NodeData[] = [];
      const locations: LocationData[] = [];
      const links: LinkData[] = [];

      // Add a default location
      locations.push({
         id: ++this.locationIdIndex,
         name: 'undefined',
         color: LOCATION_UNDEFINED
      });

      parsed.forEach(link => {
         const sourceNodeAlreadyExists = nodes.find(node => node.name === link.source);
         const targetNodeAlreadyExists = nodes.find(node => node.name === link.target);

         // Add nodes
         if (!sourceNodeAlreadyExists) {
            nodes.push({
               id: ++this.nodeIdIndex,
               name: link.source,
               positionKeyframes: [],
               statusKeyframes: []
            });
         }
         if (!targetNodeAlreadyExists) {
            nodes.push({
               id: ++this.nodeIdIndex,
               name: link.target,
               positionKeyframes: [],
               statusKeyframes: []
            });
         }

         const locationOfLinkAlreadyExists = locations.find(location => location.name === link.location);

         // Add locations
         if (!locationOfLinkAlreadyExists) {
            locations.push({
               id: ++this.locationIdIndex,
               name: link.location,
               color: locationColors[locationColorIndex++]
            });
         }

         // Add link
         const startTime: Date = new Date(link.start);
         const endTime: Date = new Date(link.end);
         const locationId = locations.find(location => location.name === link.location)?.id ?? 1;
         const sourceNodeId = nodes.find(node => node.name === link.source)?.id;
         const targetNodeId = nodes.find(node => node.name === link.target)?.id;

         if (sourceNodeId && targetNodeId) {
            links.push({
               id: ++this.linkIdIndex,
               sourceNodeId,
               targetNodeId,
               startTime,
               endTime,
               locationId
            });
         }
      });

      const startTime = links.reduce((min, link) => (link.startTime < min.startTime ? link : min)).startTime;
      const endTime = links.reduce((max, link) => (link.endTime > max.endTime ? link : max)).endTime;

      console.log(locations);
      return {
         nodes,
         links,
         states: [],
         locations,
         startTime,
         endTime
      };
   }

   public convertInfectionDataToStatusAndKeyframes (infectionData: InfectionRawData[]): DynamicNetworkData {
      const networkData = structuredClone(this.networkData.getValue());
      const defaultStatusColors = getDefaultStatusColors();
      let statusColorIndex = 0;

      // Add a default status that is shown if no other status exists
      networkData.states.push({
         id: ++this.statusIdIndex,
         name: 'undefined',
         color: HEALTH_STATE_UNDEFINED
      });

      // Add all nodes that are not already added (because they dont have any links)
      infectionData.forEach(index => {
         const nodeAlreadyExists = networkData.nodes.find(node => node.name === index.id);
         if (!nodeAlreadyExists) {
            networkData.nodes.push({
               id: ++this.nodeIdIndex,
               name: index.id,
               positionKeyframes: [],
               statusKeyframes: []
            });
         }

         // Add all unique statuses
         index.changes.forEach(entry => {
            const infectionStatusAlreadyExists = networkData.states.find(state => state.name === entry.status);
            if (!infectionStatusAlreadyExists) {
               const color =
                  entry.status === 'Diseased'
                     ? HEALTH_STATE_DISEASED
                     : entry.status === 'Carrier'
                     ? HEALTH_STATE_CARRIER
                     : defaultStatusColors[statusColorIndex++];

               networkData.states.push({
                  id: ++this.statusIdIndex,
                  name: entry.status,
                  color
               });
            }
         });

         // Assign each node the according infection status
         const node = networkData.nodes.find(node => node.name === index.id);
         if (!node) {
            return;
         }

         for (let i = 0; i < index.changes.length; i++) {
            const statusId = networkData.states.find(state => state.name === index.changes[i].status)?.id;

            if (!statusId) {
               return;
            }
            const startFrameTime = new Date(index.changes[i].timestamp);
            const startFrame = this.getFrameForAccordingDate(startFrameTime);

            const isLastChange = i === index.changes.length - 1;
            let endFrame: number;

            // Since we want to display a health status so long until it changes, we try to calculate how long we can display it until it changes
            if (isLastChange) {
               const maxFrame = this.getFrameForAccordingDate(networkData.endTime);
               endFrame = maxFrame;
            } else {
               const nextFrameStartTime = new Date(index.changes[i + 1].timestamp);
               const nextFrame = this.getFrameForAccordingDate(nextFrameStartTime);
               endFrame = nextFrame;
            }

            node.statusKeyframes.push({
               id: i,
               type: 'state',
               starFrame: startFrame,
               endFrame,
               referenceId: statusId
            });
         }
      });

      return networkData;
   }

   private calculateRenderedGraphData (dynamicNetworkData: DynamicNetworkData): TemporalNetworkGraphData[] {
      const projectSettings = this.projectSettings.getValue();
      const renderedGraphData: TemporalNetworkGraphData[] = [];

      if (dynamicNetworkData.nodes.some(node => !node.positionKeyframes || node.positionKeyframes.length === 0)) {
         // At least one node has empty or missing positionKeyframes
         // Normaly this should not be the case because MultiDynNos creates a position for every node.
         // So we assume that we dont have any positions yet, so we cannot calculate the rendered positions.
         return renderedGraphData;
      }

      for (let pointInTime = 0; pointInTime < projectSettings.totalFrames; pointInTime++) {
         const animationStartTime = new Date(dynamicNetworkData.startTime);
         const animationEndTime = new Date(dynamicNetworkData.endTime);
         const animationTimespan = animationEndTime.getTime() - animationStartTime.getTime(); // in ms
         const animationTotalFrames = projectSettings.totalFrames;

         const durationOfAFrame = animationTimespan / animationTotalFrames; // in ms

         const frameStartTime = new Date(animationStartTime.getTime() + durationOfAFrame * pointInTime);
         const frameEndTime = new Date(animationStartTime.getTime() + durationOfAFrame * (pointInTime + 1));

         const nodeGraphDataIteration: NodeGraphData[] = [];
         const linkGraphDataIteration: LinkGraphData[] = [];

         // Render nodes
         dynamicNetworkData.nodes.forEach(node => {
            const positionKeyframe = node.positionKeyframes.find(keyframe => keyframe.frame === pointInTime);
            let position: Position;

            const maxKeyFrameTime = node.positionKeyframes.reduce((max, keyframe) =>
               keyframe.frame > max.frame ? keyframe : max
            ).frame;

            const minKeyFrameTime = node.positionKeyframes.reduce((min, keyframe) =>
               keyframe.frame < min.frame ? keyframe : min
            ).frame;

            if (!positionKeyframe && pointInTime > maxKeyFrameTime) {
               const lastKeyFramePosition =
                  node.positionKeyframes.find(keyframe => keyframe.frame === maxKeyFrameTime)?.position ??
                  node.positionKeyframes[0].position;

               position = {
                  x: lastKeyFramePosition.x,
                  y: lastKeyFramePosition.y
               };
            } else if (!positionKeyframe && pointInTime < minKeyFrameTime) {
               const firstKeyFramePosition =
                  node.positionKeyframes.find(keyframe => keyframe.frame === minKeyFrameTime)?.position ??
                  node.positionKeyframes[0].position;

               position = {
                  x: firstKeyFramePosition.x,
                  y: firstKeyFramePosition.y
               };
            } else if (!positionKeyframe) {
               let nearestLowerKeyFrame: PositionKeyframe, nearestHigherKeyFrame: PositionKeyframe;
               // 1. Find the keyframe that is closest befor this timepoint
               const possibleNearestLowerKeyFrames: PositionKeyframe[] = node.positionKeyframes.filter(
                  keyframe => keyframe.frame < pointInTime
               );

               if (possibleNearestLowerKeyFrames.length > 0) {
                  nearestLowerKeyFrame = possibleNearestLowerKeyFrames.reduce((max, keyframe) =>
                     keyframe.frame > max.frame ? keyframe : max
                  );
               } else {
                  nearestLowerKeyFrame = node.positionKeyframes[0];
               }

               // 2. Find the keyframe this is closest after this timepoint
               const possibleNearestHigherKeyFrames: PositionKeyframe[] = node.positionKeyframes.filter(
                  keyframe => keyframe.frame > pointInTime
               );

               if (possibleNearestHigherKeyFrames.length > 0) {
                  nearestHigherKeyFrame = possibleNearestHigherKeyFrames.reduce((min, keyframe) =>
                     keyframe.frame < min.frame ? keyframe : min
                  );
               } else {
                  nearestHigherKeyFrame = node.positionKeyframes[node.positionKeyframes.length - 1];
               }

               // 3. Create the interpolation function

               const interpolationTime = pointInTime - nearestLowerKeyFrame.frame; // time between current timepoint and nearest lower keyframe
               const timeSpan = nearestHigherKeyFrame.frame - nearestLowerKeyFrame.frame; // time between bothe nearest keyframes

               const directionVector: Position = {
                  x: (nearestHigherKeyFrame.position.x - nearestLowerKeyFrame.position.x) / timeSpan,
                  y: (nearestHigherKeyFrame.position.y - nearestLowerKeyFrame.position.y) / timeSpan
               };

               position = {
                  x: nearestLowerKeyFrame.position.x + interpolationTime * directionVector.x,
                  y: nearestLowerKeyFrame.position.y + interpolationTime * directionVector.y
               };
            } else {
               position = positionKeyframe.position;
            }

            // Find out the state that the node has at this frame
            const referenceStateId =
               node.statusKeyframes.find(kb => kb.starFrame <= pointInTime && kb.endFrame >= pointInTime)
                  ?.referenceId ?? 1;

            nodeGraphDataIteration.push({
               id: node.id,
               name: node.name,
               x: position.x,
               y: position.y,
               referenceStateId,
               referenceLocationId: 1,
               isIsolated: false
            });
         });

         // Render links
         dynamicNetworkData.links.forEach(link => {
            const spansOverThisTimePoint = !(frameStartTime > link.endTime || frameEndTime < link.startTime);

            if (!spansOverThisTimePoint) {
               return;
            }

            const sourceNode = nodeGraphDataIteration.find(node => node.id === link.sourceNodeId);
            const targetNode = nodeGraphDataIteration.find(node => node.id === link.targetNodeId);

            if (!sourceNode || !targetNode) {
               return;
            }

            linkGraphDataIteration.push({
               id: link.id,
               source: sourceNode,
               target: targetNode,
               locationId: link.locationId
            });
         });

         // Give every node the referenceId for the location that it has at this time
         nodeGraphDataIteration.forEach(node => {
            const connectedLinks = linkGraphDataIteration.filter(
               link => link.source.id === node.id || link.target.id === node.id
            );

            if (connectedLinks.length === 0) {
               node.referenceLocationId = 1;
               node.isIsolated = true;
               return;
            }

            const firstLocationId = connectedLinks[0].locationId;
            const NotAllLinksHaveTheSameLocation = connectedLinks.some(link => link.locationId !== firstLocationId);

            node.referenceLocationId = NotAllLinksHaveTheSameLocation ? 1 : firstLocationId;
         });

         renderedGraphData.push({
            time: pointInTime,
            nodes: nodeGraphDataIteration,
            links: linkGraphDataIteration
         });
      }

      return renderedGraphData;
   }

   private getAllNodePaths (networkData: DynamicNetworkData): Observable<NodeHistoryPath[]> {
      return this.renderedGraphData$.pipe(
         take(1),
         map(renderedGraphData => {
            const nodeHistoryPaths: NodeHistoryPath[] = [];

            // To be more efficent we create a map for each frame with all node positions at the specific frame
            const nodeLookupByFrame: Map<number, Map<number, { x: number; y: number }>> = new Map();

            renderedGraphData.forEach((frameData, frameIndex) => {
               const positionMap = new Map<number, { x: number; y: number }>();
               frameData.nodes.forEach(node => {
                  positionMap.set(node.id, { x: node.x, y: node.y });
               });
               nodeLookupByFrame.set(frameIndex, positionMap);
            });

            const getNodePosition = (nodeId: number, frame: number): PositionWithFrame => {
               const frameMap = nodeLookupByFrame.get(frame);
               const pos = frameMap?.get(nodeId);
               return {
                  x: pos?.x ?? 0,
                  y: pos?.y ?? 0,
                  frame
               };
            };

            networkData.nodes.forEach(node => {
               const firstStatusStartFrame = node.statusKeyframes[0]?.starFrame ?? renderedGraphData.length;

               // Add a path for each interval in which the node has an undefined status until the first infection comes
               if (firstStatusStartFrame > 0) {
                  const pathPositions: PositionWithFrame[] = [];
                  for (let frame = 0; frame <= firstStatusStartFrame; frame++) {
                     pathPositions.push(getNodePosition(node.id, frame));
                  }

                  if (pathPositions.length > 0) {
                     nodeHistoryPaths.push({
                        nodeId: node.id,
                        referenceStateId: 1,
                        historyPoints: pathPositions
                     });
                  }
               }

               // Add paths for each infection status of the nodes
               node.statusKeyframes.forEach(kb => {
                  const pathPositions: PositionWithFrame[] = [];
                  for (let frame = kb.starFrame; frame <= kb.endFrame; frame++) {
                     pathPositions.push(getNodePosition(node.id, frame));
                  }

                  if (pathPositions.length > 0) {
                     nodeHistoryPaths.push({
                        nodeId: node.id,
                        referenceStateId: kb.referenceId,
                        historyPoints: pathPositions
                     });
                  }
               });
            });

            return nodeHistoryPaths;
         })
      );
   }

   private getCurrentNodeHistoryPath (allNodePaths: NodeHistoryPath[], currentPointInTime: number): NodeHistoryPath[] {
      return allNodePaths
         .filter(path => path.historyPoints.some(point => point.frame < currentPointInTime))
         .map(path => ({
            ...path,
            historyPoints: path.historyPoints.filter(p => p.frame < currentPointInTime)
         }));
   }

   private getNodeFuturePoints (): Observable<NodeFuturePoint[]> {
      return this.renderedGraphData$.pipe(
         take(1),
         map(renderedGraphData => {
            const nodeFuturePoints: NodeFuturePoint[] = [];
            const stepSize = Math.round(renderedGraphData.length / 10);
            for (let frame = 0; frame < renderedGraphData.length - stepSize; frame += stepSize) {
               renderedGraphData[frame].nodes.forEach(node => {
                  nodeFuturePoints.push({
                     nodeId: node.id,
                     opacity: 0,
                     frame,
                     radius: NODE_FUTURE_POINT_BIG_RADIUS,
                     futurePoint: {
                        x: node.x,
                        y: node.y
                     }
                  });
               });
            }

            return nodeFuturePoints;
         })
      );
   }

   private getCurrentNodeFuturePoints (currentPointInTime: number, nodePoints: NodeFuturePoint[]): NodeFuturePoint[] {
      const totalFrames = structuredClone(this.projectSettings.getValue()).totalFrames;
      const futureStart = currentPointInTime + 1;
      const futureEnd = totalFrames;
      const futureFrames = futureEnd - futureStart;

      const futurePoints = nodePoints.filter(point => point.frame > currentPointInTime);

      futurePoints.forEach(point => {
         const relativeProgress = (point.frame - futureStart) / futureFrames;

         point.opacity = 1 - relativeProgress;
         point.radius =
            NODE_FUTURE_POINT_BIG_RADIUS -
            relativeProgress * (NODE_FUTURE_POINT_BIG_RADIUS - NODE_FUTURE_POINT_SMALL_RADIUS);
      });

      return futurePoints;
   }

   private getAllRenderedLinks (): Observable<LinkHistory[]> {
      return this.renderedGraphData$.pipe(
         map(renderedGraphData => {
            const allRenderedLinks: LinkHistory[] = [];
            renderedGraphData.forEach(frame => {
               frame.links.forEach(link => {
                  allRenderedLinks.push({
                     linkId: link.id,
                     startPosition: {
                        x: link.source.x,
                        y: link.source.y
                     },
                     endPosition: {
                        x: link.target.x,
                        y: link.target.y
                     },
                     frame: frame.time,
                     locationId: link.locationId,
                     sourceNodeId: link.source.id,
                     targetNodeId: link.target.id
                  });
               });
            });

            return allRenderedLinks;
         })
      );
   }

   public getFrameStartAndEndTime (pointInTime: number): {
      frameStartTime: Date;
      frameEndTime: Date;
   } {
      const networkData = structuredClone(this.networkData.getValue());
      const projectSettings = structuredClone(this.projectSettings.getValue());

      const animationStartTime = new Date(networkData.startTime);
      const animationEndTime = new Date(networkData.endTime);
      const animationTimespan = animationEndTime.getTime() - animationStartTime.getTime(); // in ms
      const animationTotalFrames = projectSettings.totalFrames;

      const durationOfAFrame = animationTimespan / animationTotalFrames; // in ms

      const frameStartTime = new Date(animationStartTime.getTime() + durationOfAFrame * pointInTime);
      const frameEndTime = new Date(animationStartTime.getTime() + durationOfAFrame * (pointInTime + 1));

      return { frameStartTime, frameEndTime };
   }

   public getFrameForAccordingDate (date: Date): number {
      const networkData = structuredClone(this.networkData.getValue());
      const projectSettings = structuredClone(this.projectSettings.getValue());
      const animationStartTime = new Date(networkData.startTime).getTime();
      const animationEndTime = new Date(networkData.endTime).getTime();
      const animationTimespan = animationEndTime - animationStartTime; // in ms
      const animationTotalFrames = projectSettings.totalFrames;

      const durationOfAFrame = animationTimespan / animationTotalFrames; // ms per frame

      const timeSinceStart = date.getTime() - animationStartTime;

      let frameIndex = Math.floor(timeSinceStart / durationOfAFrame);

      frameIndex = Math.max(0, Math.min(animationTotalFrames - 1, frameIndex));

      return frameIndex;
   }
}
