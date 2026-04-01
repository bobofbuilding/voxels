export type StateCallback<State> = (state: State) => void

// Like a cut-down BABYLON.Observable, except there is also a current "state", and adding an observer for the
// state we are currently in causes the callback to be run immediately (well, next tick), like
// calling .then() on a Promise that has already settled. This avoids races when a caller cares about doing
// something in a particular state, but might only start listening after we get there.
export class StateObservable<State extends string> {
  private _stateCallbacks = new Map<State, StateCallback<State>[]>()

  public constructor(private _currentState: State) {}

  public addStateObserver(targetState: State, callback: StateCallback<State>) {
    const callbacks = this._stateCallbacks.get(targetState) ?? []
    callbacks.push(callback)
    this._stateCallbacks.set(targetState, callbacks)

    if (this._currentState === targetState) {
      setTimeout(() => callback(targetState), 0) // By the time this runs, this._currentState !== targetState is possible
    }
  }

  public removeStateObserver(targetState: State, callback: StateCallback<State>) {
    const callbacks = this._stateCallbacks.get(targetState) ?? []
    this._stateCallbacks.set(
      targetState,
      callbacks.filter((cb) => cb !== callback),
    )
  }

  // You should never need to call this. Calling it for anything besides debugging is a code smell.

  // Only runs callbacks when the new state is different. Safe to call from inside a callback.
  public setState(newState: State) {
    if (this._currentState !== newState) {
      this._currentState = newState
      setTimeout(() => this._notifyAll(newState), 0)
    }
  }

  // Instead, call .addStateListener() for the state you want to detect, and put the code you want to run in its callback.
  public getStateForDebugging() {
    return this._currentState
  }

  private _notifyAll(targetState: State) {
    const callbacks = this._stateCallbacks.get(targetState) ?? []
    for (const cb of callbacks) {
      cb(targetState)
    }
  }
}
