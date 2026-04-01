import { shorterWallet } from '../../../../common/helpers/utils'

interface AvatarInfo {
  wallet?: string
  className?: string
  name?: string | null
  showSendERC20Button?: boolean // show the 'send erc20' button; default true
  showRefresh?: boolean // show the refresh Button; default true
  showViewPage?: boolean // show the "VIew avatar page" button; default false
}

export function WalletInfo(props: AvatarInfo) {
  const wallet = props.wallet ?? '0x0000000000000000000000000000000000000000'
  const name = props.name

  return (
    <div className={`WalletInfo ${props.className || ''}`} key={wallet}>
      <div>
        <div>
          <a href={`/u/${wallet}`}>
            <span title={wallet}>{name ?? shorterWallet(wallet, 18)}</span>
          </a>
        </div>
      </div>
    </div>
  )
}
