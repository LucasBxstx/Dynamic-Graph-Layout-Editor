import {
   AfterViewInit,
   Component,
   ElementRef,
   EventEmitter,
   inject,
   Input,
   NgZone,
   OnChanges,
   Output,
   SimpleChanges
} from '@angular/core';
import * as d3 from 'd3';
import {
   DEFAULT_KEYFRAME_COLOR,
   NO_SELECTED_OBJECT_OUTLINE_COLOR,
   NOT_ALL_NODES_HAVE_KEYFRAME_COLOR,
   SELECTED_KEYFRAME_COLOR
} from '../../shared/colors';
import { KeyframeGraphData } from '../../shared/models/keyframe';

@Component({
   selector: 'app-keyframe-line',
   standalone: true,
   imports: [],
   templateUrl: './keyframe-line.component.html',
   styleUrl: './keyframe-line.component.scss'
})
export class KeyframeLineComponent implements AfterViewInit, OnChanges {
   private readonly el = inject(ElementRef);
   private readonly zone = inject(NgZone);

   private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
   private gMain?: d3.Selection<SVGGElement, unknown, null, undefined>;
   private selectionRect?: d3.Selection<SVGRectElement, unknown, null, undefined>;
   private keyframeCircles?: d3.Selection<SVGCircleElement, KeyframeGraphData, SVGGElement, unknown>;
   private startPointSelectionRect: [number, number] = [ 0, 0 ];
   private keyframeGraphData: KeyframeGraphData[] = [];

   private readonly marginX = 100;
   private readonly keyframeCircleSize = 16;

   private spacing = 0;
   private lineY = 0;
   private width = 0;
   private lineStartX = 0;
   private lineEndX = 0;

   @Input({ required: true }) numSteps!: number;
   @Input({ required: true }) currentPointerPosition!: number;
   @Input() keyFrames: number[] = [];
   @Input() currentSelectedEditingKeyFrameIds: number[] = [];
   @Input() numberOfSelectedNodes: number = 0;

   @Output() keyFrameClicked = new EventEmitter<{
      timePoint: number;
      event: MouseEvent;
   }>();
   @Output() keyFramesSelected: EventEmitter<number[]> = new EventEmitter<number[]>();
   @Output() keyframesMoved: EventEmitter<number> = new EventEmitter<number>(); // Emits the offset with that keyframes are moved

   public ngAfterViewInit (): void {
      setTimeout(() => {
         this.drawLine();
         this.createAndUpdateKeyframes();
         this.initializeSelectionRect();
      });
   }

   public ngOnChanges (changes: SimpleChanges): void {
      if (
         ('numSteps' in changes || 'keyFrames' in changes || 'currentSelectedEditingKeyFrameIds' in changes) &&
         this.svg
      ) {
         this.createAndUpdateKeyframes();
      }
   }

   private drawLine (): void {
      const rect = this.el.nativeElement.getBoundingClientRect();
      const fullWidth = rect.width ?? 180;
      const fullHeight = rect.height ? Math.max(rect.height, 40) : 40;

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

   private createAndUpdateKeyframes (): void {
      if (!this.svg) {
         return;
      }
      // Remove existing keyframe rects
      this.gMain?.selectAll('.keyframes').remove();

      this.keyframeGraphData = this.getKeyframeGraphData();
      this.createKeyframes();
   }

   private getKeyframeGraphData (): KeyframeGraphData[] {
      const keyframeGraphData: KeyframeGraphData[] = [];
      for (let frame = 0; frame < this.numSteps; frame++) {
         if (this.keyFrames.includes(frame)) {
            const x = this.lineStartX + frame * this.spacing;
            const frameOccurrence = this.keyFrames.filter(keyframe => keyframe === frame).length;
            const allNodesHaveThisKeyframe = frameOccurrence >= this.numberOfSelectedNodes;
            keyframeGraphData.push({
               frame,
               x,
               y: this.lineY,
               allNodesHaveThisKeyframe
            });
         }
      }

      return keyframeGraphData;
   }

   private createKeyframes (): void {
      this.keyframeCircles = this.gMain
         ?.append('g')
         .attr('class', 'keyframes')
         .selectAll<SVGCircleElement, KeyframeGraphData>('rect')
         .data(this.keyframeGraphData, k => k.frame)
         .join('circle')
         .attr('r', this.keyframeCircleSize / 2)
         .attr('fill', k => this.colorKeyframes(k))
         .attr('stroke', k => this.colorStrokeKeyframe(k.frame))
         .attr('stroke-width', this.keyframeCircleSize / 5)
         .style('cursor', 'pointer')
         .attr('cx', k => k.x)
         .attr('cy', this.lineY)
         .on('click', (event: MouseEvent, k: KeyframeGraphData) => this.onKeyframeClick(k.frame, event))
         .call(
            d3
               .drag<SVGCircleElement, KeyframeGraphData>()
               .on('start', this.onDragKeyframeStart.bind(this))
               .on('drag', this.onDraggingKeyframe.bind(this))
               .on('end', this.onDragKeyframeEnd.bind(this))
         );
   }

   private onDragKeyframeStart (
      event: d3.D3DragEvent<SVGCircleElement, KeyframeGraphData, unknown>,
      keyframe: KeyframeGraphData
   ): void {
      if (!this.currentSelectedEditingKeyFrameIds.includes(keyframe.frame)) {
      }
   }

   private onDraggingKeyframe (
      event: d3.D3DragEvent<SVGCircleElement, KeyframeGraphData, unknown>,
      keyframe: KeyframeGraphData
   ) {
      if (!this.currentSelectedEditingKeyFrameIds.includes(keyframe.frame)) {
         return;
      }

      const dx = event.x - keyframe.x;

      const selectedKeyframes = this.keyframeGraphData.filter(keyframe =>
         this.currentSelectedEditingKeyFrameIds.includes(keyframe.frame)
      );

      const lowerFrameBorder = this.lineStartX;
      const upperFrameBorder = this.lineStartX + this.numSteps * this.spacing;
      const movementIsForSomeKeyframesOutOfBorder = selectedKeyframes.some(
         keyframe => keyframe.x + dx < lowerFrameBorder || keyframe.x + dx > upperFrameBorder
      );

      if (movementIsForSomeKeyframesOutOfBorder) {
         return;
      }

      this.keyframeGraphData.forEach(keyframe => {
         if (this.currentSelectedEditingKeyFrameIds.includes(keyframe.frame)) {
            keyframe.x = (keyframe.x ?? 0) + dx;
         }
      });

      this.updateKeyframePositions();
   }

   private onDragKeyframeEnd (
      event: d3.D3DragEvent<SVGCircleElement, KeyframeGraphData, unknown>,
      keyframe: KeyframeGraphData
   ) {
      if (!this.currentSelectedEditingKeyFrameIds.includes(keyframe.frame)) {
         return;
      }

      const xEnd = keyframe.x;
      const newIndex = (xEnd - this.lineStartX) / this.spacing;
      const oldIndex = keyframe.frame;
      const offset = Math.round(oldIndex - newIndex);

      this.keyframesMoved.emit(offset);
   }

   private updateKeyframePositions (): void {
      this.keyframeCircles?.attr('cx', k => k.x).attr('cy', this.lineY);
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
      this.selectionRect = this.gMain!.append('rect')
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

      this.selectKeyFrames(rect);
   }

   private selectKeyFrames (rect: DOMRect | SVGRect): void {
      if (!this.selectionRect || !this.svg) {
         return;
      }

      const transform = d3.zoomTransform(this.svg.node()!);
      const selectedKeyFrames: number[] = [];

      this.keyframeCircles?.each(function (keyframe) {
         const rectNode = d3.select(this).node();
         if (!rectNode) {
            return;
         }

         const box = rectNode.getBBox();
         const [ centerX, centerY ] = [ box.x + box.width / 2, box.y + box.height / 2 ];
         const [ tx, ty ] = transform.apply([ centerX, centerY ]);

         if (tx >= rect.x && tx <= rect.x + rect.width && ty >= rect.y && ty <= rect.y + rect.height) {
            selectedKeyFrames.push(keyframe.frame);
         }
      });

      if (selectedKeyFrames.length > 0) {
         this.zone.run(() => this.keyFramesSelected.emit(selectedKeyFrames));
      }
   }

   private colorStrokeKeyframe (timePoint: number): string {
      return this.currentSelectedEditingKeyFrameIds.includes(timePoint)
         ? SELECTED_KEYFRAME_COLOR
         : NO_SELECTED_OBJECT_OUTLINE_COLOR;
   }

   private colorKeyframes (keyframe: KeyframeGraphData): string {
      return keyframe.allNodesHaveThisKeyframe ? DEFAULT_KEYFRAME_COLOR : NOT_ALL_NODES_HAVE_KEYFRAME_COLOR;
   }

   private onKeyframeClick (timePoint: number, event: MouseEvent): void {
      this.keyFrameClicked.emit({ timePoint, event });
   }
}
