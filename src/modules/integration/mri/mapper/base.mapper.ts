export abstract class BaseMapper<S, T> {
  abstract map(source: S): T;

  mapArray(source: S[]): T[] {
    return source.map((item) => this.map(item));
  }
}
