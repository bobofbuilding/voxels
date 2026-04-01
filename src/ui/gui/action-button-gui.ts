import { v7 as uuidv7 } from 'uuid'
import { Feature3D } from '../../features/feature'
import FeatureBasicGUI, { FeatureBasicGUIOptions, guiControls, guiControlsOptions } from './gui'

export default class ActionGui extends FeatureBasicGUI {
  constructor(feature: Feature3D<any>, options?: FeatureBasicGUIOptions) {
    super(feature, uuidv7(), options)
    // The GUI should work without any options given.
  }

  addButton(text?: string, options?: guiControlsOptions) {
    const newButton: guiControls = {
      text: text,
      type: 'button',
      uuid: uuidv7(),
      ...options,
    }
    this.listOfControls.push(newButton)
  }

  addText(text?: string, options?: guiControlsOptions) {
    const newText: guiControls = {
      text: text,
      type: 'text',
      uuid: uuidv7(),
      ...options,
    }
    this.listOfControls.push(newText)
  }
}
