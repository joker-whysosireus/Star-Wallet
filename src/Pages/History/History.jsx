import Menu from "../../assets/Menus/Menu/Menu";
import Header from "../../assets/Header/Header";
import './History.css';

function History({ userData }) {
    return (
        <div className="history-page">
            <Header userData={userData} />
            <div className="page-content">
                {/* Контент страницы History */}
            </div>
            <Menu />
        </div>
    );
}

export default History;