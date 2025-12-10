import Menu from "../../assets/Menus/Menu/Menu";
import Header from "../../assets/Header/Header";
import './Swap.css';

function Swap({ userData }) {
    
    return (
        <div className="page-container">
            <Header userData={userData} />
                

            <Menu />
        </div>
    );
}

export default Swap;