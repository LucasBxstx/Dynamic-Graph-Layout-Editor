import {
   AfterViewInit,
   Component,
   ElementRef,
   inject,
   Input,
   OnChanges,
   OnDestroy,
   SimpleChanges
} from '@angular/core';
import { NodeData, NodeDraft, NodeFuturePoint, NodeGraphData, NodeHistoryPath } from '../../shared/models/node';
import { LinkGraphData, LinkHistory } from '../../shared/models/link';
import { NetworkGraphData, TemporalNetworkGraphData } from '../../shared/models/network-data';
import * as d3 from 'd3';
import { fromEvent, Subject, takeUntil } from 'rxjs';
import { NetworkDataService } from '../../shared/services/network-data.service';
import {
   AFFECTED_OBJECT_COLOR,
   DEFAULT_LINK_COLOR,
   DEFAULT_NODE_COLOR,
   LINK_HISTORY_COLOR,
   NO_SELECTED_OBJECT_OUTLINE_COLOR,
   NODE_FUTURE_POINT_COLOR,
   SELECTED_OBJECT_COLOR
} from '../../shared/colors';
import { SelectionMode } from '../../shared/models/edit-options';
import { LocationData } from '../../shared/models/location';
import { StateData } from '../../shared/models/state';
import { Position } from '../../shared/models/position';
import {
   LABEL_FONT_SIZE,
   NODE_HISTORY_PATH_WIDTH,
   LINK_WIDTH,
   INITIAL_LINK_OPACITY,
   INITIAL_LINK_WIDTH,
   INITIAL_NODE_OPACITY,
   LINK_OPACITY,
   NODE_RADIUS,
   NODE_STROKE_WIDTH,
   LABEL_SPACE_FROM_NODE,
   LINK_HISTORY_WIDTH,
   LINK_HISTORY_OPACITY,
   HIDDEN_NODE_OPACITY,
   NODE_HISTORY_PATH_OPACITY
} from '../../shared/sizes';
import { TourComponent } from '../../shared/components/tour/tour.component';
import { TourService } from '../../shared/services/tour.service';
import { AsyncPipe, NgIf } from '@angular/common';

@Component({
   selector: 'app-network-graph',
   standalone: true,
   imports: [ TourComponent, NgIf, AsyncPipe ],
   templateUrl: './network-graph.component.html',
   styleUrl: './network-graph.component.scss'
})
export class NetworkGraphComponent implements OnChanges, AfterViewInit, OnDestroy {
   private unsubscribe: Subject<void> = new Subject<void>();
   private readonly networkDataService = inject(NetworkDataService);
   private readonly el = inject(ElementRef);
   public readonly tourService = inject(TourService);

   private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
   private gMain?: d3.Selection<SVGGElement, unknown, null, undefined>;
   private nodeSelection?: d3.Selection<SVGCircleElement, NodeGraphData, SVGGElement, unknown>;
   private linkSelection?: d3.Selection<SVGLineElement, LinkGraphData, SVGGElement, unknown>;
   private selectionRect?: d3.Selection<SVGRectElement, unknown, null, undefined>;
   private draftNode?: d3.Selection<SVGCircleElement, unknown, null, undefined>;
   private labelSelection?: d3.Selection<SVGTextElement, NodeGraphData, SVGGElement, unknown>;

   private initialNodeSelection?: d3.Selection<SVGCircleElement, NodeGraphData, SVGGElement, unknown>;
   private initialLinkSelection?: d3.Selection<SVGLineElement, LinkGraphData, SVGGElement, unknown>;

   private nodeHistorySelection?: d3.Selection<SVGPathElement, NodeHistoryPath, SVGElement, unknown>;
   private nodeFutureSelection?: d3.Selection<SVGCircleElement, NodeFuturePoint, SVGElement, unknown>;
   private linkHistorySelection?: d3.Selection<SVGLineElement, LinkHistory, SVGElement, unknown>;

   private startPointSelectionRect: [number, number] = [ 0, 0 ];
   private nodeDraggingStartPoint: [number, number] = [ 0, 0 ];
   private zoomTransform: d3.ZoomTransform = d3.zoomIdentity;

   private lastUpdateTime = 0;
   private throttleDelay = 10;

   //Input Data
   @Input() nodes: NodeGraphData[] = [];
   @Input() links: LinkGraphData[] = [];
   @Input() selectedNodeIds: number[] = [];
   @Input() selectedLinkIds: number[] = [];
   @Input() affectedNodeIds: number[] = []; // Nodes that are in direct contact with selected links
   @Input() affectedLinkIds: number[] = []; // Links that are in direct contact with selected nodes
   @Input() nodeWaitingToBePlaced: NodeDraft | null = null;
   @Input() locationData: LocationData[] = [];
   @Input() stateData: StateData[] = [];
   @Input() initialGraphLayout: TemporalNetworkGraphData | null = null;
   @Input() nodeHistoryPaths: NodeHistoryPath[] = [];
   @Input() nodeFuturePoints: NodeFuturePoint[] = [];
   @Input() linkHistory: LinkHistory[] = [];

   // Editing Options
   @Input() selectMode: SelectionMode = 'nothing';
   @Input() moveNodesActive: boolean = false;

   // Toggle Menu
   @Input() showNodeNames: boolean = false;
   @Input() hideIsolatedNodes: boolean = false;
   @Input() showInitialGraphLayout: boolean = false;
   @Input() colorNodesAndLinksByLocation: boolean = false;
   @Input() showNodeTrajectory: boolean = false;
   @Input() showLinkTrajectory: boolean = false;

   public ngAfterViewInit (): void {
      this.initializeGraph();
      this.updateGraphData();

      fromEvent(window, 'resize')
         .pipe(takeUntil(this.unsubscribe))
         .subscribe(() => {
            this.updateGraphData();
         });
   }

   public ngOnChanges (changes: SimpleChanges): void {
      if ('showNodeNames' in changes) {
         this.updateNodeNamesVisibility();
      }

      if ('hideIsolatedNodes' in changes) {
         this.updateGraphData();
      }

      if ('showInitialGraphLayout' in changes) {
         this.createInitialNetworkData(this.getInitialNetworkData());
         this.updatePositions();
         this.updateObjectSizes(this.zoomTransform.k);
      }

      if ('colorNodesAndLinksByLocation' in changes) {
         this.createLinkHistory(this.linkHistory);
         this.createInitialNetworkData(this.getInitialNetworkData());
         this.createNetwork(this.getNetworkData());
         this.updatePositions();
         this.updateObjectSizes(this.zoomTransform.k);
      }

      if ('showNodeTrajectory' in changes || 'nodeHistoryPaths' in changes || 'nodeFuturePoints' in changes) {
         this.createNodeHistoryPath(this.nodeHistoryPaths);
         this.createNodeFuturePoints(this.nodeFuturePoints);
         this.updatePositions();
         this.updateObjectSizes(this.zoomTransform.k);
      }

      if ('showLinkTrajectory' in changes || 'linkHistory' in changes) {
         this.createLinkHistory(this.linkHistory);
         this.updatePositions();
         this.updateObjectSizes(this.zoomTransform.k);
      }

      if (('selectedNodeIds' in changes || 'affectedNodeIds' in changes) && this.nodeSelection) {
         this.nodeSelection.attr('stroke', n => this.colorStrokeNode(n.id));

         if (this.showNodeTrajectory) {
            this.createNodeHistoryPath(this.nodeHistoryPaths);
            this.createNodeFuturePoints(this.nodeFuturePoints);

            if (this.showLinkTrajectory) {
               this.createLinkHistory(this.linkHistory);
            }
            this.updatePositions();
            this.updateObjectSizes(this.zoomTransform.k);
         }
      }

      if (('selectedLinkIds' in changes || 'affectedLinkIds' in changes) && this.linkSelection) {
         this.linkSelection.attr('stroke', l => this.colorStrokeLink(l));

         if (this.showLinkTrajectory) {
            this.createLinkHistory(this.linkHistory);
            this.updatePositions();
            this.updateObjectSizes(this.zoomTransform.k);
         }
      }

      if ('nodeWaitingToBePlaced' in changes && !!this.nodeWaitingToBePlaced) {
         this.initializeDraftNode();
      }

      if ('selectNodesActive' in changes || 'selectLinksActive' in changes) {
         this.initializeSelectionRect();
      }

      if ('nodes' in changes || 'links' in changes) {
         this.createInitialNetworkData(this.getInitialNetworkData());
         this.createNetwork(this.getNetworkData());
         this.updatePositions();
         this.updateObjectSizes(this.zoomTransform.k);
      }
   }

   public ngOnDestroy (): void {
      this.unsubscribe.next();
      this.unsubscribe.complete();
   }

   private getNetworkData (): NetworkGraphData {
      return { nodes: this.nodes, links: this.links };
   }

   private getInitialNetworkData (): NetworkGraphData {
      return {
         nodes: this.initialGraphLayout?.nodes ?? [],
         links: this.initialGraphLayout?.links ?? []
      };
   }

   private initializeGraph (): void {
      const rect = this.el.nativeElement.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      this.svg = d3
         .select(this.el.nativeElement.querySelector('#chart'))
         .append('svg')
         .attr('width', width)
         .attr('height', height)
         .attr('viewBox', [ -width / 2, -height / 2, width, height ])
         .attr('style', 'max-width: 100%; height: auto;');

      this.gMain = this.svg.append('g');

      const zoom = d3.zoom<SVGSVGElement, unknown>().on('zoom', event => {
         this.zoomTransform = event.transform;
         this.gMain?.attr('transform', event.transform);
         this.updateObjectSizes(event.transform.k);
      });
      this.svg.call(zoom as any);

      const svgElement = this.svg.node();
      svgElement?.addEventListener('contextmenu', e => e.preventDefault());

      this.svg
         .append('rect')
         .attr('class', 'svg-background')
         .attr('x', -width / 2)
         .attr('y', -height / 2)
         .attr('width', width)
         .attr('height', height)
         .style('fill', 'white')
         .style('pointer-events', 'all')
         .lower()
         .on('click', () => {
            this.onBackgroundClick();
         });
   }

   private updateGraphData (): void {
      this.createInitialNetworkData(this.getInitialNetworkData());
      this.createLinkHistory(this.linkHistory);
      this.createNodeHistoryPath(this.nodeHistoryPaths);
      this.createNodeFuturePoints(this.nodeFuturePoints);
      this.createNetwork(this.getNetworkData());
      this.initializeSelectionRect();

      this.updatePositions();
      this.updateObjectSizes(this.zoomTransform.k);
   }

   private createNetwork (data: NetworkGraphData): void {
      if (!this.gMain || !this.svg) {
         return;
      }

      this.gMain?.selectAll('.links').remove();
      this.gMain?.selectAll('.nodes').remove();
      this.gMain?.selectAll('.node-label').remove();

      this.linkSelection = this.gMain
         ?.append('g')
         .attr('class', 'links')
         .selectAll<SVGLineElement, LinkGraphData>('line')
         .data(data.links, l => `${(l.source as NodeGraphData).id}-${(l.target as NodeGraphData).id}`)
         .join('line')
         .attr('stroke', l => this.colorStrokeLink(l))
         .attr('stroke-opacity', LINK_OPACITY)
         .on('click', (event, l) => {
            this.onLinkClick(event, l);
         })
         .attr('stroke-width', LINK_WIDTH) as d3.Selection<SVGLineElement, LinkGraphData, SVGGElement, unknown>;

      const nodesGroup = this.gMain?.append('g').attr('class', 'nodes');

      this.nodeSelection = nodesGroup
         ?.selectAll<SVGCircleElement, NodeGraphData>('circle')
         .data(data.nodes, n => n.id)
         .join('circle')
         .attr('r', NODE_RADIUS / this.zoomTransform.k)
         .attr('fill', n => this.colorNode(n))
         .attr('stroke', n => this.colorStrokeNode(n.id))
         .attr('stroke-width', NODE_STROKE_WIDTH)
         .style('opacity', n => this.getNodeOpacity(n))
         .on('click', (_event, n) => this.onNodeClick(_event, n))
         .call(
            d3
               .drag<SVGCircleElement, NodeGraphData>()
               .on('start', this.onDragStart.bind(this))
               .on('drag', this.onDragging.bind(this))
               .on('end', this.onDragEnd.bind(this))
         ) as d3.Selection<SVGCircleElement, NodeGraphData, SVGGElement, unknown>;

      this.labelSelection = nodesGroup
         ?.selectAll<SVGTextElement, NodeGraphData>('text')
         .data(data.nodes, (n: NodeGraphData) => n.id)
         .join('text')
         .attr('class', 'node-label')
         .attr('text-anchor', 'middle')
         .attr('font-size', LABEL_FONT_SIZE)
         .attr('dy', LABEL_SPACE_FROM_NODE)
         .attr('opacity', d => this.getOpacityOfLabel(d))
         .text(d => (this.showNodeNames ? d.name : ''));
   }

   private createInitialNetworkData (data: NetworkGraphData): void {
      if (!this.gMain || !this.svg) {
         return;
      }

      this.gMain?.selectAll('.initial-links').remove();
      this.gMain?.selectAll('.initial-nodes').remove();

      if (!this.showInitialGraphLayout) {
         return;
      }

      this.initialLinkSelection = this.gMain
         ?.append('g')
         .attr('class', 'initial-links')
         .selectAll<SVGLineElement, LinkGraphData>('line')
         .data(data.links, l => `${(l.source as NodeGraphData).id}-${(l.target as NodeGraphData).id}`)
         .join('line')
         .attr('stroke', l => this.colorStrokeLink(l))
         .attr('stroke-opacity', INITIAL_LINK_OPACITY)
         .attr('stroke-width', INITIAL_LINK_WIDTH) as d3.Selection<SVGLineElement, LinkGraphData, SVGGElement, unknown>;

      this.initialNodeSelection = this.gMain
         ?.append('g')
         .attr('class', 'initial-nodes')
         ?.selectAll<SVGCircleElement, NodeGraphData>('circle')
         .data(data.nodes, n => n.id)
         .join('circle')
         .attr('r', NODE_RADIUS / this.zoomTransform.k)
         .attr('fill', n => this.colorNode(n))
         .style('opacity', n => INITIAL_NODE_OPACITY) as d3.Selection<
         SVGCircleElement,
         NodeGraphData,
         SVGGElement,
         unknown
      >;
   }

   private createNodeHistoryPath (data: NodeHistoryPath[]): void {
      if (!this.gMain || !this.svg) {
         return;
      }

      this.gMain?.selectAll('.history-nodes-path').remove();

      if (!this.showNodeTrajectory) {
         return;
      }

      this.nodeHistorySelection = this.gMain
         ?.append('g')
         .attr('class', 'history-nodes-path')
         ?.selectAll<SVGPathElement, NodeHistoryPath>('path')
         .data(data, p => p.nodeId)
         .join('path')
         .attr('d', d => this.lineGenerator()(d.historyPoints)!)
         .attr('fill', 'none')
         .attr('opacity', NODE_HISTORY_PATH_OPACITY)
         .attr('stroke', p => this.colorNodeHistoryPath(p))
         .attr('stroke-width', NODE_HISTORY_PATH_WIDTH / this.zoomTransform.k)
         .style('display', p => this.getVisibilityOfPath(p)) as d3.Selection<
         SVGPathElement,
         NodeHistoryPath,
         SVGGElement,
         unknown
      >;
   }

   private createNodeFuturePoints (data: NodeFuturePoint[]): void {
      if (!this.gMain || !this.svg) {
         return;
      }

      this.gMain?.selectAll('.future-nodes-points').remove();

      if (!this.showNodeTrajectory) {
         return;
      }

      this.nodeFutureSelection = this.gMain
         ?.append('g')
         .attr('class', 'future-nodes-points')
         ?.selectAll<SVGCircleElement, NodeFuturePoint>('circle')
         .data(data, n => n.nodeId)
         .join('circle')
         .attr('fill', NODE_FUTURE_POINT_COLOR)
         .attr('r', n => n.radius / this.zoomTransform.x)
         .attr('opacity', n => n.opacity)
         .style('display', n => this.getVisibilityOfPoint(n));
   }

   private createLinkHistory (data: LinkHistory[]): void {
      if (!this.svg || !this.gMain) {
         return;
      }

      if (!this.showLinkTrajectory) {
         this.gMain?.selectAll('.link-history').remove();
         return;
      }

      let groupSelection = this.gMain.select<SVGGElement>('.link-history');
      if (groupSelection.empty()) {
         groupSelection = this.gMain.append<SVGGElement>('g').attr('class', 'link-history');
      }

      const bound = groupSelection.selectAll<SVGLineElement, LinkHistory>('line').data(data, d => d.linkId);

      bound.exit().remove();

      const entered = bound
         .enter()
         .append('line')
         .attr('stroke', l => this.colorLinkHistoryStroke(l))
         .attr('stroke-width', LINK_HISTORY_WIDTH)
         .attr('opacity', LINK_HISTORY_OPACITY)
         .style('display', l => this.getVisibilityOfHistoryLink(l));

      const updated = bound
         .attr('stroke', l => this.colorLinkHistoryStroke(l))
         .attr('stroke-width', LINK_HISTORY_WIDTH)
         .attr('opacity', LINK_HISTORY_OPACITY)
         .style('display', l => this.getVisibilityOfHistoryLink(l));

      this.linkHistorySelection = entered.merge(updated);
   }

   private lineGenerator () {
      return d3
         .line<Position>()
         .x(d => d.x)
         .y(d => d.y)
         .curve(d3.curveBasis);
   }

   // For optimized performance
   private throttledUpdatePositions (): void {
      const now = Date.now();
      if (now - this.lastUpdateTime >= this.throttleDelay) {
         this.updatePositions();
         this.lastUpdateTime = now;
      }
   }

   private updatePositions (): void {
      this.nodeSelection?.attr('cx', d => d.x).attr('cy', d => d.y);

      this.linkSelection
         ?.attr('x1', d => d.source.x)
         .attr('y1', d => d.source.y)
         .attr('x2', d => d.target.x)
         .attr('y2', d => d.target.y);

      this.labelSelection
         ?.attr('x', d => d.x)
         .attr('y', d => d.y)
         .text(d => (this.showNodeNames ? d.name : ''));

      this.initialNodeSelection?.attr('cx', d => d.x).attr('cy', d => d.y);

      this.initialLinkSelection
         ?.attr('x1', d => d.source.x)
         .attr('y1', d => d.source.y)
         .attr('x2', d => d.target.x)
         .attr('y2', d => d.target.y);

      this.nodeHistorySelection?.attr('d', d => this.lineGenerator()(d.historyPoints)!);

      this.nodeFutureSelection?.attr('cx', d => d.futurePoint.x).attr('cy', d => d.futurePoint.y);

      this.linkHistorySelection
         ?.attr('x1', l => l.startPosition.x)
         .attr('x2', l => l.endPosition.x)
         .attr('y1', l => l.startPosition.y)
         .attr('y2', l => l.endPosition.y);

      d3.select('.history-nodes-path').raise();
      d3.select('.future-nodes-points').raise();
      d3.select('.links').raise();
      d3.select('.nodes').raise();
      d3.select('.node-label').raise();
   }

   // We want the nodes and links to be always at the same size, so on zoom we reverse scale them against the zoom transform
   private updateObjectSizes (zoomFactor: number): void {
      this.nodeSelection?.attr('r', NODE_RADIUS / zoomFactor).attr('stroke-width', NODE_STROKE_WIDTH / zoomFactor);
      this.linkSelection?.attr('stroke-width', LINK_WIDTH / zoomFactor);
      this.labelSelection
         ?.attr('font-size', LABEL_FONT_SIZE / zoomFactor)
         .attr('dy', LABEL_SPACE_FROM_NODE / zoomFactor);
      this.initialNodeSelection
         ?.attr('r', NODE_RADIUS / zoomFactor)
         .attr('stroke-width', NODE_STROKE_WIDTH / zoomFactor);
      this.initialLinkSelection?.attr('stroke-width', LINK_WIDTH / zoomFactor);
      this.nodeHistorySelection?.attr('stroke-width', NODE_HISTORY_PATH_WIDTH / zoomFactor);
      this.nodeFutureSelection?.attr('r', n => n.radius / zoomFactor);
      this.linkHistorySelection?.attr('stroke-width', LINK_HISTORY_WIDTH / zoomFactor);
   }

   private updateNodeNamesVisibility (): void {
      this.labelSelection?.text(d => (this.showNodeNames ? d.name : ''));
      d3.select('.node-label').raise();
   }

   private updateNodesVisibility (): void {
      this.nodeSelection?.attr('opacity', n => this.getNodeOpacity(n));
   }

   private resizeSvg (): void {
      const rect = this.el.nativeElement.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      this.svg
         ?.attr('width', width - 5)
         .attr('height', height - 5)
         .attr('viewBox', [ -width / 2, -height / 2, width, height ]);
   }

   // Although event is not used we need to keep it since node data are passed as second argument
   private onDragStart (event: d3.D3DragEvent<SVGCircleElement, NodeGraphData, unknown>, node: NodeGraphData): void {
      if (!this.selectedNodeIds.includes(node.id) || !this.moveNodesActive) {
         return;
      }

      this.nodeDraggingStartPoint = [ node.x, node.y ];
   }

   private onDragging (event: d3.D3DragEvent<SVGCircleElement, NodeGraphData, unknown>, node: NodeGraphData): void {
      if (!this.selectedNodeIds.includes(node.id) || !this.moveNodesActive) {
         return;
      }

      const dx = event.x - node.x!;
      const dy = event.y - node.y!;

      this.nodes.forEach(n => {
         if (this.selectedNodeIds.includes(n.id)) {
            // Adjust the position for each node that is moved
            n.x = (n.x ?? 0) + dx;
            n.y = (n.y ?? 0) + dy;

            // Adjust the position for each link whose source or target node was moved
            const linkIndexWhereNodeIsSource = this.links.findIndex(link => link.source.id === n.id);
            const linkIndexWhereNodeIsTarget = this.links.findIndex(link => link.target.id === n.id);

            if (linkIndexWhereNodeIsSource >= 0) {
               this.links[linkIndexWhereNodeIsSource].source.x += dx;
               this.links[linkIndexWhereNodeIsSource].source.y += dy;
            } else if (linkIndexWhereNodeIsTarget >= 0) {
               this.links[linkIndexWhereNodeIsTarget].target.x += dx;
               this.links[linkIndexWhereNodeIsTarget].target.y += dy;
            }
         }
      });

      this.throttledUpdatePositions();
   }

   // Although event is not used we need to keep it since node data are passed as second argument
   private onDragEnd (event: d3.D3DragEvent<SVGCircleElement, NodeGraphData, unknown>, node: NodeGraphData): void {
      if (!this.selectedNodeIds.includes(node.id) || !this.moveNodesActive) {
         return;
      }

      const [ xEnd, yEnd ] = [ node.x, node.y ];
      const [ xStart, yStart ] = this.nodeDraggingStartPoint;
      const offset: [number, number] = [ xStart - xEnd, yStart - yEnd ];

      this.networkDataService.moveSelectedNodes(offset);
   }

   private initializeDraftNode (): void {
      if (!this.svg) {
         return;
      }

      this.createDraftNode();
      let isMoving = true;

      this.svg
         .on('mousemove.draft', (event: MouseEvent) => {
            if (!isMoving || !this.draftNode) {
               return;
            }
            this.updateDraftNodePosition(event);
         })
         .on('mousedown.draft', (event: MouseEvent) => {
            if (!isMoving || !this.draftNode) {
               return;
            }
            isMoving = false;
            this.placeDraftNode();
         });
   }

   private createDraftNode (): void {
      this.draftNode = this.svg!.append('circle')
         .attr('class', 'draftnode')
         .attr('r', 10)
         .attr('stroke', 'rgba(122, 122, 122, 0.9)')
         .attr('stroke-width', 0.3)
         .attr('fill', 'rgba(122, 122, 122, 0.64)')
         .style('pointer-events', 'none')
         .style('display', 'none');
   }

   private updateDraftNodePosition (event: MouseEvent): void {
      const [ x, y ] = d3.pointer(event);
      this.draftNode!.attr('cx', x).attr('cy', y).style('display', 'block');
   }

   private placeDraftNode (): void {
      this.svg!.on('.draft', null);

      const [ x, y ] = d3.pointer(event);
      const transform = this.zoomTransform ?? d3.zoomIdentity;

      const transformed = transform.invert([ x, y ]);

      this.networkDataService.addNode(this.nodeWaitingToBePlaced?.name ?? '', {
         x: transformed[0],
         y: transformed[1]
      });

      this.networkDataService.removeNodeFromWaitingList();

      this.draftNode!.style('display', 'none');
   }

   // Rectangle used for visual selection
   private initializeSelectionRect (): void {
      if (!this.svg) {
         return;
      }

      this.createSelectionRect();

      let isSelecting = false;

      this.svg
         .on('mousedown.select', (event: MouseEvent) => {
            if (this.selectMode === 'nothing') {
               return;
            }
            this.startSelection(event);
            isSelecting = true;
         })
         .on('mousemove.select', (event: MouseEvent) => {
            if (!isSelecting || !this.selectionRect) {
               return;
            }
            this.updateSelection(event);
         })
         .on('mouseup.select', () => {
            if (!isSelecting || !this.selectionRect) {
               return;
            }
            isSelecting = false;
            this.finalizeSelection();
         });
   }

   private createSelectionRect (): void {
      this.selectionRect = this.svg!.append('rect')
         .attr('class', 'selection')
         .attr('stroke', 'blue')
         .attr('stroke-width', 1)
         .attr('fill', 'rgba(0, 0, 255, 0.2)')
         .style('display', 'none');
   }

   private startSelection (event: MouseEvent): void {
      this.startPointSelectionRect = d3.pointer(event);
      const [ x, y ] = this.startPointSelectionRect;

      this.selectionRect!.attr('x', x).attr('y', y).attr('width', 0).attr('height', 0).style('display', 'block');
   }

   private updateSelection (event: MouseEvent): void {
      const [ x, y ] = d3.pointer(event);
      const [ startX, startY ] = this.startPointSelectionRect;

      const rectX = Math.min(startX, x);
      const rectY = Math.min(startY, y);
      const rectWidth = Math.abs(x - startX);
      const rectHeight = Math.abs(y - startY);

      this.selectionRect!.attr('x', rectX).attr('y', rectY).attr('width', rectWidth).attr('height', rectHeight);
   }

   private finalizeSelection (): void {
      const rect = this.selectionRect?.node()?.getBBox();
      this.selectionRect?.style('display', 'none');
      if (!rect) {
         return;
      }

      if (this.selectMode === 'nodes' || this.selectMode === 'objects') {
         this.selectNodes(rect);
      }
      if (this.selectMode === 'links' || this.selectMode === 'objects') {
         this.selectLinks(rect);
      }
   }

   private selectNodes (rect: DOMRect | SVGRect): void {
      if (!this.selectionRect || !this.nodeSelection) {
         return;
      }

      // If zoom/pan is applied, we must reverse-transform the node positions
      const transform = d3.zoomTransform(this.svg!.node()!);

      const selectedNodeIds: number[] = [];

      this.nodeSelection.each(n => {
         const cx = n.x ?? 0;
         const cy = n.y ?? 0;

         // Apply transform to match actual SVG coordinates
         const [ tx, ty ] = transform.apply([ cx, cy ]);

         if (tx >= rect.x && tx <= rect.x + rect.width && ty >= rect.y && ty <= rect.y + rect.height) {
            selectedNodeIds.push(n.id);
         }
      });

      if (selectedNodeIds.length > 0) {
         this.networkDataService.onRectangleNodeSelect(selectedNodeIds);
      }
   }

   private selectLinks (rect: DOMRect | SVGRect): void {
      if (!this.selectionRect || !this.linkSelection) {
         return;
      }

      const transform = d3.zoomTransform(this.svg!.node()!);
      const selectedLinkIds: number[] = [];

      this.linkSelection.each((link: LinkGraphData) => {
         const source = link.source;
         const target = link.target;

         const [ sx, sy ] = transform.apply([ source.x ?? 0, source.y ?? 0 ]);
         const [ tx, ty ] = transform.apply([ target.x ?? 0, target.y ?? 0 ]);

         // Check if both points are within the selection rectangle
         const sourceInRect = sx >= rect.x && sx <= rect.x + rect.width && sy >= rect.y && sy <= rect.y + rect.height;

         const targetInRect = tx >= rect.x && tx <= rect.x + rect.width && ty >= rect.y && ty <= rect.y + rect.height;

         // You can change this to `&&` if you only want links fully inside
         if (sourceInRect || targetInRect) {
            selectedLinkIds.push(link.id);
         }
      });

      if (selectedLinkIds.length > 0) {
         this.networkDataService.onRectangleLinkSelect(selectedLinkIds);
      }
   }

   private colorNode (node: NodeGraphData): string {
      if (this.colorNodesAndLinksByLocation) {
         return (
            this.locationData.find(location => location.id === node.referenceLocationId)?.color ?? DEFAULT_NODE_COLOR
         );
      } else {
         return this.stateData.find(state => state.id === node.referenceStateId)?.color ?? DEFAULT_NODE_COLOR;
      }
   }

   private colorStrokeNode (nodeId: number): string {
      return this.selectedNodeIds.includes(nodeId)
         ? SELECTED_OBJECT_COLOR
         : this.affectedNodeIds.includes(nodeId)
         ? AFFECTED_OBJECT_COLOR
         : NO_SELECTED_OBJECT_OUTLINE_COLOR;
   }

   private colorStrokeLink (link: LinkGraphData): string {
      // const LOCATION_COLOR = this.locationData.find(location => location.id === link.locationId)?.color;
      // Always color links by location
      // return this.selectedLinkIds.includes(link.id)
      //    ? this.darkenHexColor(LOCATION_COLOR ?? DEFAULT_LINK_COLOR, 0.2)
      //    : LOCATION_COLOR ?? DEFAULT_LINK_COLOR;

      // Only color links by location if toggle is active

      if (this.colorNodesAndLinksByLocation) {
         const LOCATION_COLOR = this.locationData.find(location => location.id === link.locationId)?.color;
         // return LOCATION_COLOR ?? DEFAULT_LINK_COLOR;  //In case that we want to display only the location color and not the selection
         // return this.selectedLinkIds.includes(link.id) ? SELECTED_OBJECT_COLOR : LOCATION_COLOR ?? DEFAULT_LINK_COLOR;
         return this.selectedLinkIds.includes(link.id)
            ? this.darkenHexColor(LOCATION_COLOR ?? DEFAULT_LINK_COLOR, 0.2)
            : LOCATION_COLOR ?? DEFAULT_LINK_COLOR;
      }

      return this.selectedLinkIds.includes(link.id)
         ? SELECTED_OBJECT_COLOR
         : this.affectedLinkIds.includes(link.id)
         ? AFFECTED_OBJECT_COLOR
         : DEFAULT_LINK_COLOR;
   }

   private getNodeOpacity (node: NodeGraphData): number {
      if (this.hideIsolatedNodes) {
         return node.isIsolated ? HIDDEN_NODE_OPACITY : 1;
      } else {
         return 1;
      }
   }

   private getVisibilityOfPath (path: NodeHistoryPath): string {
      const node = this.nodes.find(node => node.id === path.nodeId);

      if (this.hideIsolatedNodes && node && node.isIsolated) {
         return 'none';
      }
      if (this.selectedNodeIds.length === 0) {
         return 'block';
      } else if (this.selectedNodeIds.includes(path.nodeId)) {
         return 'block';
      } else {
         return 'none';
      }
   }

   private getVisibilityOfPoint (point: NodeFuturePoint): string {
      const node = this.nodes.find(node => node.id === point.nodeId);

      if (this.hideIsolatedNodes && node && node.isIsolated) {
         return 'none';
      }
      if (this.selectedNodeIds.length === 0) {
         return 'block';
      } else if (this.selectedNodeIds.includes(point.nodeId)) {
         return 'block';
      } else {
         return 'none';
      }
   }

   private getVisibilityOfHistoryLink (link: LinkHistory): string {
      const sourceNode = this.nodes.find(node => node.id === link.sourceNodeId);
      const targetNode = this.nodes.find(node => node.id === link.targetNodeId);

      if (this.hideIsolatedNodes && ((sourceNode && sourceNode.isIsolated) || (targetNode && targetNode.isIsolated))) {
         return 'none';
      } else if (this.selectedLinkIds.length === 0 && this.selectedNodeIds.length === 0) {
         return 'block';
      } else if (this.selectedLinkIds.includes(link.linkId)) {
         return 'block';
      } else if (this.selectedNodeIds.includes(link.sourceNodeId) && this.selectedNodeIds.includes(link.targetNodeId)) {
         return 'block';
      } else {
         return 'none';
      }
   }

   private getOpacityOfLabel (node: NodeGraphData): number {
      if (this.hideIsolatedNodes) {
         return node.isIsolated ? HIDDEN_NODE_OPACITY : 1;
      }
      return 1;
   }

   private colorLinkHistoryStroke (link: LinkHistory): string {
      if (this.colorNodesAndLinksByLocation) {
         const location = this.locationData.find(location => location.id === link.locationId);
         return location?.color ?? LINK_HISTORY_COLOR;
      } else {
         return LINK_HISTORY_COLOR;
      }
   }

   private colorNodeHistoryPath (path: NodeHistoryPath): string {
      return this.stateData.find(state => state.id === path.referenceStateId)?.color ?? DEFAULT_NODE_COLOR;
   }

   private onBackgroundClick (): void {
      this.networkDataService.deselectNodesAndLinks();
   }

   private onNodeClick (event: MouseEvent, node: NodeGraphData): void {
      const userPressedSTRG = event.ctrlKey;
      this.networkDataService.onNodeClicked(node.id, userPressedSTRG);
   }

   private onLinkClick (event: MouseEvent, link: LinkGraphData): void {
      const userPressedSTRG = event.ctrlKey;
      this.networkDataService.onLinkClicked(link.id, userPressedSTRG);
   }

   private darkenHexColor (hex: string, amount: number = 0.2): string {
      let color = hex.replace('#', '');
      if (color.length === 3) {
         color = color
            .split('')
            .map(c => c + c)
            .join('');
      }
      const num = parseInt(color, 16);

      let r = Math.max(0, (num >> 16) - 255 * amount);
      let g = Math.max(0, ((num >> 8) & 0x00ff) - 255 * amount);
      let b = Math.max(0, (num & 0x0000ff) - 255 * amount);

      r = Math.round(r);
      g = Math.round(g);
      b = Math.round(b);

      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
   }
}
