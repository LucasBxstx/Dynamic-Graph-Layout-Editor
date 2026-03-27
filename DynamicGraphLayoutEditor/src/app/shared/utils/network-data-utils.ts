// export function getDefaultLocationColors (): string[] {
//    return [
//       '#1E90FF', // Dodger Blue
//       '#8A2BE2', // Blue Violet
//       '#FF69B4', // Hot Pink
//       '#00CED1', // Dark Turquoise
//       '#BA55D3', // Medium Orchid
//       '#FF8C00', // Dark Orange
//       '#7B68EE', // Medium Slate Blue
//       '#40E0D0', // Turquoise
//       '#DA70D6', // Orchid
//       '#4682B4' // Steel Blue
//    ];
// }

import { LOCATION_COLOR_1, LOCATION_COLOR_2, LOCATION_COLOR_3, LOCATION_COLOR_4, LOCATION_COLOR_5 } from '../colors';

export function getDefaultLocationColors (): string[] {
   return [ LOCATION_COLOR_1, LOCATION_COLOR_2, LOCATION_COLOR_3, LOCATION_COLOR_4, LOCATION_COLOR_5 ];
}

export function getDefaultStatusColors (): string[] {
   return [
      '#7CFC00', // Lawn Green
      //'#32CD32', // Lime Green
      '#FFD700', // Gold (Yellow)
      '#FF0000', // Red
      '#FF8C00' // Dark Orange
   ];
}

export function isFirstDateSmaller (firstDate: Date, secondDate: Date): boolean {
   return new Date(firstDate).getTime() < new Date(secondDate).getTime();
}

export function isFirstDateLarger (firstDate: Date, secondDate: Date): boolean {
   return new Date(firstDate).getTime() > new Date(secondDate).getTime();
}
