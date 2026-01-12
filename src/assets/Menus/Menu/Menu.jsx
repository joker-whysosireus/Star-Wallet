import { Link, useLocation } from 'react-router-dom';
import './Menu.css';
import HistoryWhite from '../img-jsx/HistoryWhite';
import HistoryGold from '../img-jsx/HistoryGold';
import WalletGold from '../img-jsx/WalletGold';
import WalletWhite from '../img-jsx/WalletWhite';
import SwapGold from '../img-jsx/SwapGold';
import SwapWhite from '../img-jsx/SwapWhite';
import StakeGold from '../img-jsx/StakeGold';
import StakeWhite from '../img-jsx/StakeWhite';

const Menu = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Активность Wallet для всех связанных страниц
  const isWalletActive = 
    currentPath === '/' || 
    currentPath === '/wallet' || 
    currentPath.startsWith('/wallet/token/') ||
    currentPath === '/send' ||
    currentPath === '/usdt-detail' ||
    currentPath === '/usdc-detail' ||
    currentPath === '/receive';
  
  const menuItems = [
    { 
      path: '/wallet', 
      name: 'Wallet', 
      iconActive: <WalletWhite />, 
      iconInactive: <WalletGold />,
      isActive: isWalletActive
    },
    { 
      path: '/swap', 
      name: 'Swap', 
      iconActive: <SwapGold />, 
      iconInactive: <SwapWhite />,
      isActive: currentPath === '/swap'
    },
    { 
      path: '/history', 
      name: 'History', 
      iconActive: <HistoryGold />, 
      iconInactive: <HistoryWhite />,
      isActive: currentPath === '/history'
    },
    { 
      path: '/stake', 
      name: 'Stake', 
      iconActive: <StakeGold />, 
      iconInactive: <StakeWhite />,
      isActive: currentPath === '/stake'
    },
  ];

  const handleClick = (path) => (event) => {
    if (menuItems.find(item => item.path === path)?.isActive) {
      event.preventDefault();
    }
  };

  return (
    <div className="menu">
      {menuItems.map((item) => (
        <div 
          key={item.path}
          className={`menu-item ${item.isActive ? 'active' : ''}`}
        >
          <Link to={item.path} onClick={handleClick(item.path)}>
            {item.isActive ? item.iconActive : item.iconInactive}
            <span className="Name">{item.name}</span>
          </Link>
        </div>
      ))}
    </div>
  );
};

export default Menu;