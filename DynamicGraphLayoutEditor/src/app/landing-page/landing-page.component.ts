import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NetworkDataService } from '../shared/services/network-data.service';
import { SlideToggleService } from '../shared/services/slide-toggle.service';

@Component({
   selector: 'app-landing-page',
   standalone: true,
   imports: [],
   templateUrl: './landing-page.component.html',
   styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit {
   private readonly router = inject(Router);
   private readonly networkDataService = inject(NetworkDataService);
   private readonly slideToggleService = inject(SlideToggleService);

   public ngOnInit (): void {
      const isFirstAppUse = localStorage.getItem('isFirstAppUse') !== 'false';
      if (isFirstAppUse) {
         localStorage.setItem('isFirstAppUse', 'true');
      }
   }

   public navigateToCreateNewProjectPage (): void {
      this.slideToggleService.setAllTogglesToDefault();
      this.router.navigate([ 'create-new-project' ], {
         queryParams: {
            usecase: 'create'
         }
      });
   }

   public navigateToManageFilePage (): void {
      this.slideToggleService.setAllTogglesToDefault();
      this.router.navigate([ 'manage-imported-files' ], {
         queryParams: {
            usecase: 'create'
         }
      });
   }

   public async openProject (event: Event): Promise<void> {
      this.slideToggleService.setAllTogglesToDefault();
      const input = event.target as HTMLInputElement;
      const file = input.files![0];
      if (!file) {
         return;
      }

      const reader = new FileReader();

      reader.onload = () => {
         try {
            const content = reader.result as string;
            const parsed = JSON.parse(content);

            if (parsed.networkData && parsed.projectSettings && parsed.initialNetworkData) {
               this.networkDataService.openProject(
                  parsed.projectSettings,
                  parsed.networkData,
                  parsed.initialNetworkData
               );
               this.router.navigate([ 'dashboard' ]);
            } else {
               console.error('Invalid file structure.');
            }
         } catch (e) {
            console.error('Failed to load progress:', e);
         }
      };

      reader.readAsText(file);
   }
}
