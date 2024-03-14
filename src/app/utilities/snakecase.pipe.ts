import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'snakecase'
})
export class SnakecasePipe implements PipeTransform {

  transform(value: string, undo: 'undo' | undefined): string {
    if (undo === 'undo') {
      return value?.replace(/_/g, ' ');
    } else {
      return value?.replace(/ /g, '_');
    }
  }

}
