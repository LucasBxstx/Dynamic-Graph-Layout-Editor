import { Component, inject } from '@angular/core';
import { NetworkDataService } from '../shared/services/network-data.service';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { NgIf } from '@angular/common';
import { DynamicNetworkData, TemporalNetworkGMLData } from '../shared/models/network-data';
import { LinkGML } from '../shared/models/link';
import { NodeGML } from '../shared/models/node';

export type Usecase = 'create' | 'edit';

@Component({
   selector: 'app-manage-imported-files',
   standalone: true,
   imports: [ NgIf ],
   templateUrl: './manage-imported-files.component.html',
   styleUrl: './manage-imported-files.component.scss'
})
export class ManageImportedFilesComponent {
   private readonly networkDataService = inject(NetworkDataService);
   private readonly activatedRoute = inject(ActivatedRoute);
   private readonly router = inject(Router);

   public usecase: Usecase = 'create';
   public selectedHealthcareFileName?: string;
   public selectedInfectionsFileName?: string;
   public selectedMultiDynNosFileNames?: string[];

   /* eslint-disable */
   public ngOnInit(): void {
      this.activatedRoute.queryParams.pipe(take(1)).subscribe(queryParams => {
         this.usecase = queryParams['usecase'];
      });

      if (this.usecase === 'edit') {
         this.networkDataService.projectSettings$.pipe(take(1)).subscribe(settings => {});
      }
   }

   public navigateToDashboard(): void {
      this.router.navigate(['dashboard']);
   }

   public navigateToHome(): void {
      this.router.navigate(['landing']);
   }

   public async onJsonFileSelect(event: Event, context: 'healthcare' | 'infections'): Promise<void> {
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

            if (context === 'healthcare') {
               this.selectedHealthcareFileName = file.name;
               const initialNetworkData = this.networkDataService.convertHealthCareDataToNodesAndLinks(parsed);
               const fileName = file.name.replace(/\.json$/, '');
               this.networkDataService.createNewNetworkFromImportDataset(initialNetworkData, fileName);
            } else if (context === 'infections') {
               this.selectedInfectionsFileName = file.name;
               const initialInfectionData = this.networkDataService.convertInfectionDataToStatusAndKeyframes(parsed);
               this.networkDataService.mergeInfectionDataIntoNetworkData(initialInfectionData);
            } else {
               console.error('Invalid file structure.');
            }
         } catch (e) {
            console.error('Failed to load progress:', e);
         }
      };

      reader.readAsText(file);
   }

   public async onMultiDynNosFileSelected(event: Event): Promise<void> {
      const input = event.target as HTMLInputElement;

      if (!input?.files) {
         return;
      }

      this.selectedMultiDynNosFileNames = [];

      const files = Array.from(input.files);

      const fileReadPromises = files.map((file, index) => {
         this.selectedMultiDynNosFileNames!.push(file.name);
         return new Promise<TemporalNetworkGMLData>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
               const gmlContent = reader.result as string;
               const extractedData = this.getTemporalNetworkGMLData(gmlContent, index);
               resolve(extractedData);
            };

            reader.onerror = error => {
               console.error('Fehler beim Lesen der Datei:', error);
               reject(error);
            };

            reader.readAsText(file);
         });
      });

      try {
         const convertedNetworkGMLData = await Promise.all(fileReadPromises);
         this.networkDataService.mergeMultiDynNosDataIntoNetworkData(convertedNetworkGMLData);
      } catch (error) {
         console.error('Ein oder mehrere Dateien konnten nicht gelesen werden.', error);
      }
   }

   private getTemporalNetworkGMLData(fileContent: string, time: number): TemporalNetworkGMLData {
      const { nodes, links } = this.parseGmlFile(fileContent);

      return {
         sliceNumber: time,
         nodes,
         links
      };
   }

   private parseGmlFile(file: string): { nodes: NodeGML[]; links: LinkGML[] } {
      const nodes: NodeGML[] = [];
      const links: LinkGML[] = [];

      const nodeRegex =
         /node\s*\[\s*id\s+([^\s]+)[^\]]*?graphics\s*\[\s*x\s+([-\d.]+)\s*y\s+([-\d.]+)\s*w\s+([-\d.]+)\s*h\s+([-\d.]+)\s*\]/g;
      const linkRegex = /edge\s*\[\s*source\s+([^\s]+)\s*target\s+([^\s]+)\s*graphics\s*\[\s*\]\s*\]/g;

      let match;

      while ((match = nodeRegex.exec(file)) !== null) {
         nodes.push({
            id: match[1],
            graphics: {
               x: parseFloat(match[2]),
               y: parseFloat(match[3]),
               w: parseFloat(match[4]),
               h: parseFloat(match[5])
            }
         });
      }

      while ((match = linkRegex.exec(file)) !== null) {
         links.push({
            source: match[1],
            target: match[2],
            graphics: null
         });
      }

      return { nodes, links };
   }
}
