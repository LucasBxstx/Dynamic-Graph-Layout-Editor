import {
   AfterViewInit,
   ChangeDetectorRef,
   Component,
   ElementRef,
   EventEmitter,
   inject,
   Input,
   OnChanges,
   Output,
   SimpleChanges
} from '@angular/core';
import * as d3 from 'd3';
import { ProjectSettings } from '../../shared/models/project-settings';
import { TimeFormatPipe } from '../../shared/pipes/time-format.pipe';
import { DynamicNetworkData } from '../../shared/models/network-data';

@Component({
   selector: 'app-timeline',
   standalone: true,
   imports: [ TimeFormatPipe ],
   templateUrl: './timeline.component.html',
   styleUrl: './timeline.component.scss'
})
export class TimelineComponent implements AfterViewInit, OnChanges {
   private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
   private gMain?: d3.Selection<SVGGElement, unknown, null, undefined>;

   private readonly el = inject(ElementRef);
   private readonly changeDetector = inject(ChangeDetectorRef);
   private readonly marginX = 100;

   private spacing = 0;
   private lineY = 0;
   private width = 0;
   private lineStartX = 0;
   private lineEndX = 0;

   public totalAnimationDuration: number = 0;
   public currentAnimationTime: number = 0;

   @Input({ required: true }) numSteps!: number;
   @Input({ required: true }) currentPointerPosition!: number;
   @Input({ required: true }) networkData: DynamicNetworkData | null = null;
   @Input({ required: true }) projectSettings: ProjectSettings | null = null;

   @Output() pointerPositionChangedThroughSlider = new EventEmitter<number>();
   @Output() frameClicked = new EventEmitter<number>();

   public ngAfterViewInit (): void {
      setTimeout(() => {
         this.drawTimeline();
         this.updatePointer();
         this.updateTimer();
         this.changeDetector.detectChanges();
      });
   }

   public ngOnChanges (changes: SimpleChanges): void {
      if (('currentPointerPosition' in changes || 'projectSettings' in changes) && this.svg) {
         this.updatePointer();
         this.updateTimer();
         this.updateVisibilityOfDates();
      }
   }

   private updateTimer (): void {
      if (!this.projectSettings) {
         return;
      }

      this.totalAnimationDuration = Math.round(this.projectSettings.totalAnimationDuration);
      this.currentAnimationTime = Math.round(
         (this.currentPointerPosition / this.projectSettings.totalFrames) * this.totalAnimationDuration
      );
   }

   private updateVisibilityOfDates (): void {
      const threshold = 20;
      const hideStartDate = this.currentPointerPosition > this.numSteps - this.numSteps / threshold;
      const hideEndDate = this.currentPointerPosition < this.numSteps / threshold;

      this.svg?.select('#start-label').attr('opacity', hideStartDate ? 0 : 1);
      this.svg?.select('#end-label').attr('opacity', hideEndDate ? 0 : 1);
   }

   private drawTimeline (): void {
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

      // Draw the main timeline line
      this.gMain
         .append('line')
         .attr('x1', this.lineStartX)
         .attr('y1', this.lineY)
         .attr('x2', this.lineEndX)
         .attr('y2', this.lineY)
         .attr('stroke', 'black')
         .attr('stroke-width', 2);

      // Draw the rectangles (steps)
      for (let i = 0; i < this.numSteps; i++) {
         const x = this.lineStartX + i * this.spacing;
         this.gMain
            .append('rect')
            .attr('x', x - 2)
            .attr('y', this.lineY - 2.5)
            .attr('width', 4)
            .attr('height', 5)
            .attr('fill', 'gray')
            .style('cursor', 'pointer')
            .on('click', (event: MouseEvent) => this.onTimeStepClick(i));
      }

      const drag = d3.drag<SVGCircleElement, unknown>().on('drag.cursor', event => {
         // Move the circle exactly with the mouse
         const clampedX = Math.max(this.lineStartX, Math.min(event.x, this.lineEndX));
         d3.select(event.sourceEvent.target as SVGCircleElement).attr('cx', clampedX);

         // Emit snapped index
         const index = Math.round((clampedX - this.lineStartX) / this.spacing);
         if (index !== this.currentPointerPosition) {
            this.currentPointerPosition = index;
            this.pointerPositionChangedThroughSlider.emit(index);
         }
      });

      // Draw initial pointer
      const initialX = this.lineStartX + this.currentPointerPosition * this.spacing;
      this.gMain
         .append('circle')
         .attr('id', 'pointer-circle')
         .attr('r', 8)
         .attr('cy', this.lineY)
         .attr('cx', initialX)
         .attr('fill', '#bd1313')
         .style('cursor', 'pointer')
         .call(drag);

      const formatDate = d3.timeFormat('%d.%m.%Y');

      this.gMain
         .append('text')
         .attr('id', 'end-label')
         .attr('x', this.lineStartX - 30)
         .attr('y', this.lineY + 20)
         .attr('text-anchor', 'center')
         .attr('font-size', '12px')
         .attr('fill', 'black')
         .text(formatDate(new Date(this.networkData!.startTime)));

      this.gMain
         .append('text')
         .attr('id', 'start-label')
         .attr('x', this.lineEndX - 30)
         .attr('y', this.lineY + 20)
         .attr('text-anchor', 'center')
         .attr('font-size', '12px')
         .attr('fill', 'black')
         .text(formatDate(new Date(this.networkData!.endTime)));

      this.gMain
         .append('text')
         .attr('id', 'pointer-label')
         .attr('x', initialX - 30)
         .attr('y', this.lineY + 20)
         .attr('font-size', '12px')
         .attr('fill', 'black')
         .text(formatDate(new Date(this.getFrameStartAndEndTime(this.currentPointerPosition).frameStartTime)));
   }

   private updatePointer (): void {
      const formatDate = d3.timeFormat('%d.%m.%Y');
      const pointerX = this.lineStartX + this.currentPointerPosition * this.spacing;
      this.svg?.select('#pointer-circle').transition().duration(0.1).attr('cx', pointerX);
      this.svg
         ?.select('#pointer-label')
         .transition()
         .duration(0.1)
         .attr('x', pointerX - 30)
         .text(formatDate(new Date(this.getFrameStartAndEndTime(this.currentPointerPosition).frameStartTime)));
   }

   private onTimeStepClick (timePoint: number): void {
      this.frameClicked.emit(timePoint);
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
