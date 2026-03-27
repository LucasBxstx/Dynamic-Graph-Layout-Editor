import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NetworkDataService } from '../shared/services/network-data.service';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Subject, take, takeUntil } from 'rxjs';
import { NgIf } from '@angular/common';
import { MatNativeDateModule } from '@angular/material/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ProjectSettings } from '../shared/models/project-settings';

export type usecase = 'create' | 'edit';

@Component({
   selector: 'app-create-new-project',
   standalone: true,
   imports: [ FormsModule, NgIf, MatDatepickerModule, MatNativeDateModule, MatFormFieldModule, ReactiveFormsModule ],
   templateUrl: './create-new-project.component.html',
   styleUrl: './create-new-project.component.scss'
})
export class CreateNewProjectComponent implements OnInit, OnDestroy {
   private readonly unsubscribe = new Subject<void>();
   private readonly networkDataService = inject(NetworkDataService);
   private readonly activatedRoute = inject(ActivatedRoute);
   private readonly router = inject(Router);

   public readonly range = new FormGroup({
      start: new FormControl<Date | null>(null),
      end: new FormControl<Date | null>(null)
   });

   public usecase: usecase = 'create';
   public projectTitle: string = '';
   public numberOfDays: number = 0;
   public animationTimeForOneDay: number = 4;
   public totalAnimationDuration: number = 0;
   public framesPerSecond: number = 24;
   public totalFrames: number = 1;

   /* eslint-disable */
   public ngOnInit(): void {
      this.activatedRoute.queryParams.pipe(take(1)).subscribe(queryParams => {
         this.usecase = queryParams['usecase'];
      });

      this.range.valueChanges.pipe(takeUntil(this.unsubscribe)).subscribe(range => {
         if (range.start && range.end) {
            this.onInputChanges();
         }
      });

      if (this.usecase === 'edit') {
         combineLatest([this.networkDataService.projectSettings$, this.networkDataService.networkData$])
            .pipe(take(1))
            .subscribe(([settings, networkData]) => {
               this.projectTitle = settings.projectTitle;
               this.numberOfDays = this.calculateNumberOfDays(networkData.startTime, networkData.endTime);
               this.animationTimeForOneDay = settings.animationTimeForOneDay;
               this.totalAnimationDuration = settings.totalAnimationDuration;
               this.framesPerSecond = settings.framesPerSecond;
               this.totalFrames = settings.totalFrames;

               this.range.setValue({
                  start: networkData.startTime,
                  end: networkData.endTime
               });
            });
      }
   }

   public ngOnDestroy(): void {
      this.unsubscribe.next();
      this.unsubscribe.complete();
   }

   public onSaveChanges(): void {
      this.usecase === 'create' ? this.createNewProject() : this.saveChanges();
   }

   public onInputChanges(): void {
      const startDate = this.range.getRawValue().start;
      const endDate = this.range.getRawValue().end;

      if (!startDate || !endDate) {
         return;
      }

      this.numberOfDays = this.calculateNumberOfDays(startDate, endDate);
      this.totalAnimationDuration = Math.round(this.numberOfDays * this.animationTimeForOneDay);
      this.totalFrames = this.totalAnimationDuration * this.framesPerSecond;
   }

   public onDurationChanges(): void {
      this.animationTimeForOneDay = Math.round((this.totalAnimationDuration / this.numberOfDays) * 100) / 100;
   }

   private createNewProject(): void {
      const timeRange = this.range.getRawValue();
      if (!this.totalFrames || !timeRange.start || !timeRange.end) {
         return;
      }

      const projectSettings = this.getProjectSettings();

      this.networkDataService.createNewNetwork(projectSettings, timeRange.start, timeRange.end);
      this.router.navigate(['dashboard']);
   }

   private saveChanges(): void {
      const projectSettings = this.getProjectSettings();
      this.networkDataService.updateProjectSettings(projectSettings);

      this.router.navigate(['dashboard']);
   }

   public navigateToLanding(): void {
      this.router.navigate(['landing']);
   }

   public navigateToDashboard(): void {
      this.router.navigate(['dashboard']);
   }

   private getProjectSettings(): ProjectSettings {
      return {
         projectTitle: this.projectTitle,
         animationTimeForOneDay: this.animationTimeForOneDay,
         totalAnimationDuration: this.totalAnimationDuration,
         framesPerSecond: this.framesPerSecond,
         totalFrames: this.totalFrames
      };
   }

   private calculateNumberOfDays(startDate: Date, endDate: Date): number {
      const timeSpanInMS = Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime());
      return Math.round(timeSpanInMS / (1000 * 60 * 60 * 24)) + 1;
   }
}
