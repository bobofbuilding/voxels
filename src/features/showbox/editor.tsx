import { Component } from 'preact'
import { app } from '../../../web/src/state'
import { PanelType } from '../../../web/src/components/panel'
import { Position, Rotation, Scale, Behaviours, EditorProps } from '../../../web/src/components/editor'
import { Advanced, FeatureEditor, FeatureEditorProps, FeatureID, Toolbar } from '../../ui/features'
import { MAX_VOLUME, mobile, LANDSCAPE_SCALE, PORTRAIT_SCALE, GuestMode, MirrorSource, DEFAULT_GUEST_MODE } from './context'
import type Showbox from './scene'

export default class Editor extends FeatureEditor<Showbox> {
  constructor(props: FeatureEditorProps<Showbox>) {
    super(props)
    this.state = {
      id: props.feature.description.id,
      rolloffFactor: props.feature.rolloffFactor,
      volume: props.feature.volume,
      guestMode: props.feature.guestMode === 'solo' ? 'solo' : 'cohost',
      mirrorSource: props.feature.mirrorSource,
      angleMode: props.feature.description.angleMode !== false, // default a mirror to second-screen mode
      screenShape: props.feature.screenShape === 'portrait' ? 'portrait' : 'landscape',
    }
  }

  componentDidUpdate(_prevProps: FeatureEditorProps<Showbox>, prevState: typeof this.state) {
    this.merge({
      rolloffFactor: this.state.rolloffFactor,
      volume: this.state.volume,
      guestMode: this.state.guestMode,
      mirrorSource: this.state.mirrorSource,
      angleMode: this.state.angleMode,
      screenShape: this.state.screenShape,
    })
    if (prevState.screenShape !== this.state.screenShape) {
      this.props.feature.set({
        scale: this.state.screenShape === 'portrait' ? PORTRAIT_SCALE : LANDSCAPE_SCALE,
      })
    }
  }

  render() {
    const isMirror = this.props.feature.isMirror()
    return (
      <section>
        <Toolbar feature={this.props.feature} scene={this.props.scene} />
        <EditorProps>
          <Position feature={this.props.feature} key={this.props.feature.position.toString()} />
          <Scale feature={this.props.feature} key={this.props.feature.scale.toString()} />
          <Rotation feature={this.props.feature} key={this.props.feature.rotation.toString()} />
          {isMirror ? (
            <div className="f">
              <label>Mode</label>
              <select value={this.state.angleMode ? 'second' : 'mirror'} onChange={(e) => this.setState({ angleMode: e.currentTarget.value === 'second' })}>
                <option value="second">Second screen</option>
                <option value="mirror">Mirror showbox</option>
              </select>
              {this.state.angleMode ? (
                <div className="f">
                  <small>A dedicated screen for an extra feed, no audio. Share a screen or add a camera, then drag and resize it in-world.</small>
                  <div>
                    <button type="button" onClick={() => void this.props.feature.startAngleBroadcast(undefined, true)}>
                      Share screen
                    </button>{' '}
                    <button type="button" onClick={() => this.props.feature.openAnglePanel(true)}>
                      Add camera
                    </button>
                  </div>
                </div>
              ) : (
                <div className="f">
                  <label>Source</label>
                  <select value={this.state.mirrorSource} onChange={(e) => this.setState({ mirrorSource: e.currentTarget.value as MirrorSource })}>
                    <option value="auto">whoever is live</option>
                    <option value="host">host (parcel owner)</option>
                    <option value="collaborator">collaborator</option>
                    <option value="guest">guest</option>
                  </select>
                  <small>Mirrors the first showbox video with no audio. Falls back to whoever is live if your pick isn't streaming. Manage the stream and guest links on the first showbox.</small>
                </div>
              )}
            </div>
          ) : (
            <GuestPasses feature={this.props.feature} guestMode={this.state.guestMode} onGuestModeChange={(guestMode) => this.setState({ guestMode })} />
          )}
          {!isMirror && (
            <div className="f">
              <label>Screen shape</label>
              <div>
                <label>
                  <input type="radio" name="screenShape" checked={this.state.screenShape === 'landscape'} onChange={() => this.setState({ screenShape: 'landscape' })} />
                  landscape
                </label>
                <label>
                  <input type="radio" name="screenShape" checked={this.state.screenShape === 'portrait'} onChange={() => this.setState({ screenShape: 'portrait' })} />
                  portrait
                </label>
              </div>
            </div>
          )}
          <Advanced>
            <FeatureID feature={this.props.feature} />
            {!isMirror && (
              <div className="f">
                <label>Spatial Rolloff Factor</label>
                <input type="range" step="0.1" min="0" max="5" value={this.state.rolloffFactor} onChange={(e) => this.setState({ rolloffFactor: parseFloat(e.currentTarget.value) })} />
                <small>0 = heard everywhere in the parcel. Higher = fades as you walk away from the screen.</small>
              </div>
            )}
            {!isMirror && (
              <div className="f">
                <label>Volume</label>
                <input type="range" step="0.01" min="0" max={MAX_VOLUME} value={this.state.volume} onChange={(e) => this.setState({ volume: parseFloat(e.currentTarget.value) })} />
              </div>
            )}
            <Behaviours feature={this.props.feature} />
          </Advanced>
        </EditorProps>
      </section>
    )
  }
}

type Pass = { token: string; parcel_id: number; feature_uuid: string; name: string; created_at: string; revoked_at: string | null }

class GuestPasses extends Component<{ feature: Showbox; guestMode: GuestMode; onGuestModeChange: (mode: GuestMode) => void }, { passes: Pass[]; loading: boolean; creating: boolean; error: string | null }> {
  state = { passes: [] as Pass[], loading: true, creating: false, error: null as string | null }
  linkListRef: HTMLDivElement | null = null
  refreshGen = 0

  componentDidMount() {
    this.refresh()
  }

  parcelId() {
    return this.props.feature.parcel.id
  }

  featureUuid() {
    return this.props.feature.uuid
  }

  passActive(p: Pass) {
    return !p.revoked_at
  }

  applyPass(pass: Pass) {
    this.setState((s) => ({
      passes: [pass, ...s.passes.filter((p) => p.token !== pass.token)],
    }))
  }

  passesUrl() {
    return `/api/parcels/${this.parcelId()}/guest-passes?feature_uuid=${encodeURIComponent(this.featureUuid())}`
  }

  canManagePasses() {
    return this.props.feature.parcel.canEdit
  }

  async refresh() {
    const gen = ++this.refreshGen
    try {
      const r = await fetch(this.passesUrl(), { credentials: 'include', cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (gen !== this.refreshGen) return false
      if (!r.ok || !j.success) {
        this.setState({ error: j.error || 'could not load guest links', loading: false })
        return false
      }
      this.setState({ passes: j.passes ?? [], loading: false, error: null })
      if (!(j.passes ?? []).some((p: Pass) => !p.revoked_at)) {
        this.props.onGuestModeChange(DEFAULT_GUEST_MODE)
      }
      return true
    } catch {
      if (gen !== this.refreshGen) return false
      this.setState({ loading: false, error: 'could not load guest links' })
      return false
    }
  }

  async copyGuestLink() {
    if (!this.canManagePasses()) {
      this.setState({ error: 'you need edit access on this parcel to copy guest links' })
      return
    }
    this.setState({ creating: true, error: null })
    try {
      let token = this.state.passes.find((p) => this.passActive(p))?.token ?? null
      if (!token) {
        const r = await fetch(`/api/parcels/${this.parcelId()}/guest-passes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          cache: 'no-store',
          body: JSON.stringify({ feature_uuid: this.featureUuid() }),
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || !j.success) throw new Error(j.error || 'Could not create link')
        const pass = j.pass as Pass | undefined
        if (!pass?.token) throw new Error('Could not create link')
        token = pass.token
        this.applyPass(pass)
      }
      this.copy(this.liveUrl(token), 'co-host link copied')
    } catch (e: any) {
      const msg = e?.message ?? 'Could not create link'
      if (String(msg).toLowerCase().includes('revoke')) {
        await this.refresh()
        this.setState({ error: 'a guest link is already active - copy it below' })
      } else {
        this.setState({ error: msg })
      }
    } finally {
      this.setState({ creating: false })
    }
  }

  async create() {
    if (!this.canManagePasses()) {
      this.setState({ error: 'you need edit access on this parcel to create guest links' })
      return
    }
    if (this.state.passes.some((p) => this.passActive(p))) {
      this.setState({ error: 'revoke the existing link first' })
      return
    }
    this.refreshGen++
    this.setState({ creating: true, error: null })
    try {
      const r = await fetch(`/api/parcels/${this.parcelId()}/guest-passes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ feature_uuid: this.featureUuid() }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.success) throw new Error(j.error || 'Could not create link')
      const pass = j.pass as Pass | undefined
      if (!pass?.token) throw new Error('Could not create link')
      const url = this.liveUrl(pass.token)
      this.copy(url, 'guest link created (copied)')
      this.applyPass(pass)
      requestAnimationFrame(() => this.linkListRef?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
    } catch (e: any) {
      const msg = e?.message ?? 'Could not create link'
      if (String(msg).toLowerCase().includes('revoke')) {
        await this.refresh()
        this.setState({ error: 'a guest link is already active - copy or revoke it below' })
      } else {
        this.setState({ error: msg })
      }
    } finally {
      this.setState({ creating: false })
    }
  }

  async revoke(token: string) {
    if (!this.canManagePasses()) {
      this.setState({ error: 'you need edit access on this parcel to revoke guest links' })
      return
    }
    if (!confirm('Revoke this link? They will be kicked if currently live.')) return
    this.refreshGen++
    this.setState({ error: null })
    try {
      const r = await fetch(`/api/parcels/${this.parcelId()}/guest-passes/${encodeURIComponent(token)}`, {
        method: 'DELETE',
        credentials: 'include',
        cache: 'no-store',
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.success) throw new Error(j.error || 'could not revoke link')
      const passes = (j.passes as Pass[] | undefined) ?? (j.pass ? [j.pass as Pass] : [])
      const revoked = passes.filter((p) => p?.revoked_at)
      if (!revoked.length) throw new Error('could not revoke link')
      this.setState((s) => ({
        passes: [...revoked, ...s.passes.filter((p) => !revoked.some((r) => r.token === p.token))],
      }))
      this.props.onGuestModeChange(DEFAULT_GUEST_MODE)
      app.showSnackbar('guest link revoked', PanelType.Success)
    } catch (e: any) {
      this.setState({ error: e?.message ?? 'could not revoke link' })
      await this.refresh()
    }
  }

  copy(text: string, snackbar = 'link copied') {
    navigator.clipboard.writeText(text).catch(() => {})
    app.showSnackbar(snackbar, PanelType.Success)
  }

  liveUrl(token: string) {
    return `${window.location.origin}/live/${token}`
  }

  render() {
    if (!this.props.feature.parcel.canEdit) return null
    const active = this.state.passes.filter((p) => this.passActive(p))
    const canManage = this.canManagePasses()

    return (
      <div className="f">
        <label>Go Live</label>
        <small>
          From anywhere. <a href="/golive">http://voxels.com/golive</a>
        </small>

        <label>Co-host link</label>
        <small>Send this to your DJ, artist, or guest on camera. Not for the audience.</small>

        {canManage && (
          <button type="button" style={mobile ? { minHeight: '44px' } : undefined} onClick={() => void this.copyGuestLink()} disabled={this.state.creating}>
            {this.state.creating ? 'creating...' : 'copy co-host link'}
          </button>
        )}
        {!canManage && <small>edit access required</small>}

        {this.state.error && <div style={{ color: 'var(--red)' }}>{this.state.error}</div>}

        {this.state.loading && <small>loading...</small>}

        {active.length > 0 && (
          <div
            ref={(el) => {
              this.linkListRef = el
            }}
          >
            {active.map((p) => (
              <div key={p.token}>
                <div className="f">
                  {!!p.name?.trim() && <label>{p.name.trim()}</label>}
                  <input type="text" readOnly value={this.liveUrl(p.token)} onClick={(e) => (e.currentTarget as HTMLInputElement).select()} style={mobile ? { fontSize: '16px', minHeight: '44px' } : undefined} />
                </div>
                {canManage && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <button type="button" style={mobile ? { minHeight: '44px' } : undefined} onClick={() => this.revoke(p.token)}>
                      revoke
                    </button>
                  </div>
                )}
                <div className="f">
                  <label>Guest mode</label>
                  <div>
                    <label>
                      <input type="radio" name="guestMode" checked={this.props.guestMode === 'cohost'} onChange={() => this.props.onGuestModeChange('cohost')} />
                      Co-host
                    </label>
                    <label>
                      <input type="radio" name="guestMode" checked={this.props.guestMode === 'solo'} onChange={() => this.props.onGuestModeChange('solo')} />
                      Guest only
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
}
