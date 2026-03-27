import { Component, ElementRef, EventEmitter, inject, Input, NgZone, Output, SimpleChanges } from '@angular/core';
import {
   KeyframeBlock,
   KeyframeBlockEdgeGraphData,
   KeyframeBlockGraphData,
   KeyFrameBlockType
} from '../../shared/models/keyframe';
import * as d3 from 'd3';
import { StateData } from '../../shared/models/state';
import { LINK_DURATION_KEYFRAME_BLOCK_COLOR, FALLBACK_COLOR } from '../../shared/colors';
import { DynamicNetworkData } from '../../shared/models/network-data';
import { ProjectSettings } from '../../shared/models/project-settings';

@Component({
   selector: 'app-keyframe-block-line',
   standalone: true,
   imports: [],
   templateUrl: './keyframe-block-line.component.html',
   styleUrl: './keyframe-block-line.component.scss'
})
export class KeyframeBlockLineComponent {
   private readonly el = inject(ElementRef);

   private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
   private gMain?: d3.Selection<SVGGElement, unknown, null, undefined>;
   private keyframeBlocks?: d3.Selection<SVGLineElement, KeyframeBlockGraphData, SVGGElement, unknown>;
   private keyframeBlockGraphData: KeyframeBlockGraphData[] = [];
   private keyframeBlockEdges?: d3.Selection<SVGCircleElement, KeyframeBlockEdgeGraphData, SVGGElement, unknown>;
   private keyframeBlockEdgeGraphData: KeyframeBlockEdgeGraphData[] = [];
   private draggingLastCursorPosition: [number, number] = [ 0, 0 ];

   private readonly marginX = 100;
   private readonly keyframeBlockHeight = 16;

   private spacing = 0;
   private lineY = 0;
   private width = 0;
   private lineStartX = 0;
   private lineEndX = 0;

   @Input({ required: true }) type!: KeyFrameBlockType;
   @Input({ required: true }) numSteps!: number;
   @Input({ required: true }) networkData: DynamicNetworkData | null = null;
   @Input({ required: true }) projectSettings: ProjectSettings | null = null;
   @Input() keyFrameBlocks: KeyframeBlock[] = [];
   @Input() selectedKeyframeBlockIds: number[] = [];
   @Input() stateData: StateData[] = [];

   @Output() keyframeBlockClicked = new EventEmitter<{
      keyframeId: number;
      holdControl: boolean;
   }>();
   @Output() keyframeBlockMoved = new EventEmitter<{ offset: number }>();
   @Output() changedDurationOfKeyframeBlock = new EventEmitter<{
      keyframeId: number;
      startFrame: number;
      endFrame: number;
   }>();

   public ngAfterViewInit (): void {
      setTimeout(() => {
         this.drawLine();
         this.createAndUpdateKeyframeBlocks();
      });
   }

   public ngOnChanges (changes: SimpleChanges): void {
      if (
         ('numSteps' in changes ||
            'keyFrameBlocks' in changes ||
            'selectedKeyframeBlockIds' in changes ||
            'stateData' in changes) &&
         this.svg
      ) {
         this.createAndUpdateKeyframeBlocks();
      }
   }

   private drawLine (): void {
      const rect = this.el.nativeElement.getBoundingClientRect();
      const fullWidth = rect.width ?? 180;
      const fullHeight = rect.height ? Math.max(rect.height, 50) : 50;

      this.width = fullWidth - this.marginX * 2;
      this.lineY = fullHeight / 2;
      this.spacing = this.width / (this.numSteps - 1);
      this.lineStartX = this.marginX;
      this.lineEndX = this.marginX + this.width;

      this.svg = d3
         .select(this.el.nativeElement.querySelector('#chart'))
         .append('svg')
         .attr('width', fullWidth)
         .attr('height', fullHeight);

      this.gMain = this.svg.append('g');

      // Draw the main line
      this.gMain
         .append('line')
         .attr('x1', this.lineStartX)
         .attr('y1', this.lineY)
         .attr('x2', this.lineEndX)
         .attr('y2', this.lineY)
         .attr('stroke', 'grey')
         .attr('stroke-width', 2);
   }

   private createAndUpdateKeyframeBlocks (): void {
      if (!this.svg) {
         return;
      }
      // Remove existing keyframe rects
      this.gMain?.selectAll('.keyframe-blocks').remove();
      this.gMain?.selectAll('.keyframe-block-edges').remove();
      this.gMain?.selectAll('[id^="kb-edge-label-"]').remove();

      this.keyframeBlockGraphData = this.getKeyframeBlockGraphData();
      this.keyframeBlockEdgeGraphData = this.getKeyframeBlockEdgesGraphData();

      this.createKeyframeBlocks();
      this.createKeyframeBlockEdges();
   }

   private getKeyframeBlockGraphData (): KeyframeBlockGraphData[] {
      return this.keyFrameBlocks.map(kb => ({
         id: kb.id,
         type: kb.type,
         referenceId: kb.referenceId,
         startFrame: kb.starFrame,
         endFrame: kb.endFrame,
         xStart: this.lineStartX + this.spacing * kb.starFrame,
         xEnd: this.lineStartX + this.spacing * kb.endFrame,
         y: this.lineY
      }));
   }

   private getKeyframeBlockEdgesGraphData (): KeyframeBlockEdgeGraphData[] {
      const keyframeBlockEdges: KeyframeBlockEdgeGraphData[] = [];
      this.keyFrameBlocks.forEach(keyframeBlock => {
         if (!this.selectedKeyframeBlockIds.includes(keyframeBlock.id)) {
            return;
         }

         keyframeBlockEdges.push({
            keyframeBlockId: keyframeBlock.id,
            blockType: keyframeBlock.type,
            referenceId: keyframeBlock.referenceId,
            edgeType: 'start',
            frame: keyframeBlock.starFrame,
            x: this.lineStartX + this.spacing * keyframeBlock.starFrame,
            y: this.lineY
         });
         keyframeBlockEdges.push({
            keyframeBlockId: keyframeBlock.id,
            blockType: keyframeBlock.type,
            referenceId: keyframeBlock.referenceId,
            edgeType: 'end',
            frame: keyframeBlock.endFrame,
            x: this.lineStartX + this.spacing * keyframeBlock.endFrame,
            y: this.lineY
         });
      });

      return keyframeBlockEdges;
   }

   private createKeyframeBlocks (): void {
      const movementThreshold = 5;
      let startX: number, startY: number;
      let hasDragged = false;

      const dragBehavior = d3
         .drag<SVGLineElement, KeyframeBlockGraphData>()
         .on('start', (event, d) => {
            startX = event.x;
            startY = event.y;
            hasDragged = false;
            this.onDragKeyframeBlockStart(event, d);
         })
         .on('drag', (event, d) => {
            const dx = Math.abs(event.x - startX);
            const dy = Math.abs(event.y - startY);

            if (dx > movementThreshold || dy > movementThreshold) {
               hasDragged = true;
               this.onDraggingKeyframeBlock(event, d);
            }
         })
         .on('end', (event, d) => {
            if (hasDragged) {
               this.onDragKeyframeBlockEnd(event, d);
            }
         });

      this.keyframeBlocks = this.gMain
         ?.append('g')
         .attr('class', 'keyframe-blocks')
         .selectAll<SVGLineElement, KeyframeBlockGraphData>('line')
         .data(this.keyframeBlockGraphData, k => `${k.startFrame}-${k.endFrame}`)
         .join('line')
         .attr('stroke', k => this.colorStrokeKeyframeBlock(k))
         .attr('stroke-opacity', 1)
         .attr('stroke-width', this.keyframeBlockHeight)
         .attr('x1', k => k.xStart)
         .attr('x2', k => k.xEnd)
         .attr('y1', k => k.y)
         .attr('y2', k => k.y)
         .style('cursor', 'pointer')
         .on('click', (event, k) => {
            // Nur ausführen, wenn es KEIN Drag war
            if (!hasDragged) {
               this.onKeyframeBlockClick(k, event);
            }
         })
         .call(dragBehavior);
   }

   private createKeyframeBlockEdges (): void {
      this.keyframeBlockEdges = this.gMain
         ?.append('g')
         .attr('class', 'keyframe-block-edges')
         .selectAll<SVGCircleElement, KeyframeBlockEdgeGraphData>('circle')
         .data(this.keyframeBlockEdgeGraphData, k => k.frame)
         .join('circle')
         .attr('r', this.keyframeBlockHeight / 2)
         .attr('fill', k => this.colorKeyframeBlockEdge(k))
         .attr('stroke', 'black')
         .attr('stroke-width', this.keyframeBlockHeight / 10)
         .style('cursor', 'pointer')
         .attr('cx', k => k.x)
         .attr('cy', k => k.y)
         .call(
            d3
               .drag<SVGCircleElement, KeyframeBlockEdgeGraphData>()
               .on('start', this.onDragKeyframeBlockEdgeStart.bind(this))
               .on('drag', this.onDraggingKeyframeBlockEdge.bind(this))
               .on('end', this.onDragKeyframeBlockEdgeEnd.bind(this))
         );

      const formatDate = d3.timeFormat('%d.%m.%Y');
      const filteredKBEdges = this.keyframeBlockEdgeGraphData.filter(kbe =>
         this.selectedKeyframeBlockIds.includes(kbe.keyframeBlockId)
      );
      filteredKBEdges.forEach(kbe => {
         this.gMain
            ?.append('text')
            .attr('id', `kb-edge-label-${kbe.keyframeBlockId}-${kbe.edgeType}`)
            .attr('x', kbe.x - 30)
            .attr('y', this.lineY + 20)
            .attr('font-size', '12px')
            .attr('fill', 'black')
            .text(formatDate(new Date(this.getFrameStartAndEndTime(kbe.frame).frameStartTime)));
      });
   }

   private onDragKeyframeBlockStart (
      event: d3.D3DragEvent<SVGLineElement, KeyframeBlockGraphData, unknown>,
      keyframe: KeyframeBlockGraphData
   ): void {
      if (!this.selectedKeyframeBlockIds.includes(keyframe.id)) {
         return;
      }
      this.draggingLastCursorPosition = d3.pointer(event);
   }

   private onDraggingKeyframeBlock (
      event: d3.D3DragEvent<SVGLineElement, KeyframeBlockGraphData, unknown>,
      keyframe: KeyframeBlockGraphData
   ) {
      if (!this.selectedKeyframeBlockIds.includes(keyframe.id)) {
         return;
      }
      const dx = event.x - this.draggingLastCursorPosition[0];

      const selectedKeyframeBlocks = this.keyframeBlockGraphData.filter(keyframe =>
         this.selectedKeyframeBlockIds.includes(keyframe.id)
      );

      const movementIsForSomeKeyframesOutOfBorder = selectedKeyframeBlocks.some(
         keyframe => keyframe.xStart + dx < this.lineStartX || keyframe.xEnd + dx > this.lineEndX
      );

      if (movementIsForSomeKeyframesOutOfBorder) {
         return;
      }

      if (selectedKeyframeBlocks.length === 1) {
         const kbsBefore = this.keyframeBlockGraphData.filter(kb => kb.endFrame <= keyframe.startFrame);
         const kbsAfter = this.keyframeBlockGraphData.filter(kb => kb.startFrame >= keyframe.endFrame);
         const nearestKBBeforeXEnd =
            kbsBefore.length === 0
               ? this.lineStartX
               : kbsBefore.reduce((kb, max) => (kb.endFrame > max.endFrame ? kb : max)).xEnd;
         const nearestKBAfterXStart =
            kbsAfter.length === 0
               ? this.lineEndX
               : kbsAfter.reduce((kb, min) => (kb.startFrame < min.startFrame ? kb : min)).xStart;
         const movementGoesOverOtherKB =
            keyframe.xStart + dx < nearestKBBeforeXEnd || keyframe.xEnd + dx > nearestKBAfterXStart;

         if (movementGoesOverOtherKB) {
            return;
         }
      }

      this.keyframeBlockGraphData.forEach(keyframe => {
         if (this.selectedKeyframeBlockIds.includes(keyframe.id)) {
            keyframe.xStart = (keyframe.xStart ?? 0) + dx;
            keyframe.xEnd = (keyframe.xEnd ?? 0) + dx;

            // Find the according edges
            const edges = this.keyframeBlockEdgeGraphData.filter(edge => edge.referenceId === keyframe.referenceId);
            edges.forEach(edge => {
               edge.x = edge.edgeType === 'start' ? keyframe.xStart : keyframe.xEnd;
            });
         }
      });

      this.draggingLastCursorPosition = [ event.x, event.y ];

      this.updateKeyframeBlockPositions();
   }

   private onDragKeyframeBlockEnd (
      event: d3.D3DragEvent<SVGLineElement, KeyframeBlockGraphData, unknown>,
      keyframe: KeyframeBlockGraphData
   ) {
      if (!this.selectedKeyframeBlockIds.includes(keyframe.id)) {
         return;
      }

      const newStartFrame = Math.round((keyframe.xStart - this.lineStartX) / this.spacing);
      const oldStartFrame = keyframe.startFrame;
      const offset = oldStartFrame - newStartFrame;

      this.keyframeBlockMoved.emit({
         offset
      });
   }

   private updateKeyframeBlockPositions (): void {
      this.keyframeBlocks
         ?.attr('x1', k => k.xStart)
         .attr('x2', k => k.xEnd)
         .attr('y1', k => k.y)
         .attr('y2', k => k.y);

      this.keyframeBlockEdges?.attr('cx', k => k.x).attr('cy', k => k.y);
      this.updateKeyframeBlockEdgeLabelPosition();
   }

   private updateKeyframeBlockEdgeLabelPosition (): void {
      const formatDate = d3.timeFormat('%d.%m.%Y');
      const filteredKBEdges = this.keyframeBlockEdgeGraphData.filter(kbe =>
         this.selectedKeyframeBlockIds.includes(kbe.keyframeBlockId)
      );

      filteredKBEdges.forEach(kbe => {
         const frame = Math.round((kbe.x - this.lineStartX) / this.spacing);
         this.svg
            ?.select(`#kb-edge-label-${kbe.keyframeBlockId}-${kbe.edgeType}`)
            .transition()
            .duration(0.1)
            .attr('x', kbe.x - 30)
            .text(formatDate(new Date(this.getFrameStartAndEndTime(frame).frameStartTime)));
      });
   }

   private onKeyframeBlockClick (keyframeBlock: KeyframeBlockGraphData, event: MouseEvent): void {
      this.keyframeBlockClicked.emit({
         keyframeId: keyframeBlock.id,
         holdControl: event.ctrlKey
      });
   }

   private onDragKeyframeBlockEdgeStart (
      event: d3.D3DragEvent<SVGCircleElement, KeyframeBlockEdgeGraphData, unknown>,
      edge: KeyframeBlockEdgeGraphData
   ) {
      if (!this.selectedKeyframeBlockIds.includes(edge.keyframeBlockId)) {
         return;
      }
      this.draggingLastCursorPosition = d3.pointer(event);
   }
   private onDraggingKeyframeBlockEdge (
      event: d3.D3DragEvent<SVGCircleElement, KeyframeBlockEdgeGraphData, unknown>,
      edge: KeyframeBlockEdgeGraphData
   ) {
      if (!this.selectedKeyframeBlockIds.includes(edge.keyframeBlockId)) {
         return;
      }
      const dx = event.x - this.draggingLastCursorPosition[0];

      const otherEdge = this.keyframeBlockEdgeGraphData.find(
         otherEdge => otherEdge.keyframeBlockId === edge.keyframeBlockId && otherEdge !== edge
      );

      if (!otherEdge) {
         return;
      }

      const movementGoesOverOtherFrame =
         edge.edgeType === 'start' ? edge.x + dx >= otherEdge.x : edge.x + dx <= otherEdge.x;

      const movementIsOutOfBorder =
         edge.edgeType === 'start' ? edge.x + dx <= this.lineStartX : edge.x + dx >= this.lineEndX;

      let movementGoesOverOtherKFBlock = false;

      if (edge.edgeType === 'end') {
         const kfBlocksAfterwards = this.keyframeBlockGraphData.filter(kb => kb.startFrame >= edge.frame);
         movementGoesOverOtherKFBlock = kfBlocksAfterwards.some(kb => edge.x + dx > kb.xStart);
      } else if (edge.edgeType === 'start') {
         const kfBlocksBefore = this.keyframeBlockGraphData.filter(kb => kb.endFrame <= edge.frame);
         movementGoesOverOtherKFBlock = kfBlocksBefore.some(kb => edge.x + dx < kb.xEnd);
      }

      if (movementIsOutOfBorder || movementGoesOverOtherFrame || movementGoesOverOtherKFBlock) {
         return;
      }

      this.keyframeBlockGraphData.forEach(keyframe => {
         if (this.selectedKeyframeBlockIds.includes(keyframe.id)) {
            if (edge.edgeType === 'start') {
               keyframe.xStart = (keyframe.xStart ?? 0) + dx;
            }
            if (edge.edgeType === 'end') {
               keyframe.xEnd = (keyframe.xEnd ?? 0) + dx;
            }

            keyframe.startFrame = Math.round((keyframe.xStart - this.lineStartX) / this.spacing) + 1;
            keyframe.endFrame = Math.round((keyframe.xEnd - this.lineStartX) / this.spacing) + 1;

            // Find the according edges
            const edges = this.keyframeBlockEdgeGraphData.filter(edge => edge.keyframeBlockId === keyframe.id);
            edges.forEach(edge => {
               edge.x = edge.edgeType === 'start' ? keyframe.xStart : keyframe.xEnd;
               edge.frame = Math.round((edge.x - this.lineStartX) / this.spacing);
            });
         }
      });

      this.draggingLastCursorPosition = [ event.x, event.y ];

      this.updateKeyframeBlockPositions();
   }
   private onDragKeyframeBlockEdgeEnd (
      event: d3.D3DragEvent<SVGCircleElement, KeyframeBlockEdgeGraphData, unknown>,
      edge: KeyframeBlockEdgeGraphData
   ) {
      if (!this.selectedKeyframeBlockIds.includes(edge.keyframeBlockId)) {
         return;
      }
      const kb = this.keyframeBlockGraphData.find(kb => kb.id === edge.keyframeBlockId);

      if (!kb) {
         return;
      }

      this.changedDurationOfKeyframeBlock.emit({
         keyframeId: kb.id,
         startFrame: kb.startFrame,
         endFrame: kb.endFrame
      });
   }

   private colorKeyframeBlockEdge (edge: KeyframeBlockEdgeGraphData): string {
      if (edge.blockType === 'state') {
         const STATE_COLOR = this.stateData.find(state => state.id === edge.referenceId)?.color ?? FALLBACK_COLOR;
         return this.selectedKeyframeBlockIds.includes(edge.keyframeBlockId)
            ? this.lightenHexColor(STATE_COLOR, 0.3)
            : STATE_COLOR;
      } else {
         return this.selectedKeyframeBlockIds.includes(edge.keyframeBlockId)
            ? this.lightenHexColor(LINK_DURATION_KEYFRAME_BLOCK_COLOR, 0.3)
            : LINK_DURATION_KEYFRAME_BLOCK_COLOR;
      }
   }

   private colorStrokeKeyframeBlock (k: KeyframeBlockGraphData): string {
      if (k.type === 'state') {
         const STATE_COLOR = this.stateData.find(state => state.id === k.referenceId)?.color ?? FALLBACK_COLOR;
         return this.selectedKeyframeBlockIds.includes(k.id) ? this.lightenHexColor(STATE_COLOR, 0.1) : STATE_COLOR;
      } else {
         return this.selectedKeyframeBlockIds.includes(k.id)
            ? this.lightenHexColor(LINK_DURATION_KEYFRAME_BLOCK_COLOR, 0.1)
            : LINK_DURATION_KEYFRAME_BLOCK_COLOR;
      }
   }

   private lightenHexColor (hex: string, amount: number = 0.2): string {
      let color = hex.replace('#', '');
      if (color.length === 3) {
         color = color
            .split('')
            .map(c => c + c)
            .join('');
      }
      const num = parseInt(color, 16);

      let r = Math.min(255, (num >> 16) + 255 * amount);
      let g = Math.min(255, ((num >> 8) & 0x00ff) + 255 * amount);
      let b = Math.min(255, (num & 0x0000ff) + 255 * amount);

      r = Math.round(r);
      g = Math.round(g);
      b = Math.round(b);

      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
   }

   private getFrameStartAndEndTime (pointInTime: number): {
      frameStartTime: Date;
      frameEndTime: Date;
   } {
      const animationStartTime = new Date(this.networkData!.startTime);
      const animationEndTime = new Date(this.networkData!.endTime);
      const animationTimespan = animationEndTime.getTime() - animationStartTime.getTime(); // in ms
      const animationTotalFrames = this.projectSettings!.totalFrames;

      const durationOfAFrame = animationTimespan / animationTotalFrames; // in ms

      const frameStartTime = new Date(animationStartTime.getTime() + durationOfAFrame * pointInTime);
      const frameEndTime = new Date(animationStartTime.getTime() + durationOfAFrame * (pointInTime + 1));

      return { frameStartTime, frameEndTime };
   }
}
