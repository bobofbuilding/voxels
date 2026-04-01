import { Feature2D } from './feature'

export class Unhandled extends Feature2D<any> {
  generate() {
    return Promise.resolve()
  }

  whatIsThis() {
    return "This feature is currently unhandled. It's likely has been deprecated and removed"
  }
}
