import {
   AfterViewInit,
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
import { EventPoint, TimeLineEventType } from '../../shared/models/time-line-event';
import { StateData } from '../../shared/models/state';
import { LocationData } from '../../shared/models/location';
import { FALLBACK_COLOR } from '../../shared/colors';
import { TIMELINE_EVENT_JITTER_Y, TIMELINE_EVENT_RADIUS } from '../../shared/sizes';

@Component({
   selector: 'app-event-line',
   standalone: true,
   imports: [],
   templateUrl: './event-line.component.html',
   styleUrl: './event-line.component.scss'
})
export class EventLineComponent implements AfterViewInit, OnChanges {
   private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
   private gMain?: d3.Selection<SVGGElement, unknown, null, undefined>;
   private eventSelection?: d3.Selection<SVGCircleElement, EventPoint, SVGElement, unknown>;

   private readonly el = inject(ElementRef);

   private marginX = 100;
   private spacing = 0;
   private lineY = 0;
   private width = 0;
   private lineStartX = 0;
   private lineEndX = 0;

   @Input({ required: true }) numSteps!: number;
   @Input({ required: true }) eventType!: TimeLineEventType;
   @Input() eventPoints: EventPoint[] = [];
   @Input() states: StateData[] = [];
   @Input() locations: LocationData[] = [];

   @Output() eventClicked = new EventEmitter<number>();

   public ngAfterViewInit (): void {
      setTimeout(() => {
         this.drawLine();
         this.drawEvents(this.eventPoints);
      });
   }

   public ngOnChanges (changes: SimpleChanges): void {
      if ('numSteps' in changes || 'eventPoints' in changes || 'states' in changes || 'locations' in changes) {
         this.drawEvents(this.eventPoints);
      }
   }

   private drawLine (): void {
      const rect = this.el.nativeElement.getBoundingClientRect();
      const fullWidth = rect.width ?? 180;
      const fullHeight = rect.height ? Math.max(rect.height, 20) : 20;

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
   }

   private drawEvents (data: EventPoint[]): void {
      if (!this.svg || !this.gMain) {
         return;
      }

      this.gMain.selectAll('.event-points').remove();

      this.eventSelection = this.gMain
         .append('g')
         .attr('class', 'event-points')
         ?.selectAll<SVGCircleElement, EventPoint>('circle')
         .data(data, e => e.id)
         .join('circle')
         .attr('fill', e => this.getEventColor(e))
         .attr('r', TIMELINE_EVENT_RADIUS)
         .attr('cx', e => Math.min(this.lineStartX + e.frame * this.spacing, this.lineEndX))
         .attr('cy', () => this.lineY - TIMELINE_EVENT_JITTER_Y / 2 + TIMELINE_EVENT_JITTER_Y * Math.random())
         .on('click', (event: MouseEvent, e: EventPoint) => this.eventClicked.emit(e.frame));
   }

   private getEventColor (eventPoint: EventPoint): string {
      if (this.eventType === 'status') {
         const correspondingStatus = this.states.find(state => state.id === eventPoint.referenceId);
         return correspondingStatus?.color ?? FALLBACK_COLOR;
      } else {
         const correspondingLocation = this.locations.find(location => location.id === eventPoint.referenceId);
         return correspondingLocation?.color ?? FALLBACK_COLOR;
      }
   }
}
