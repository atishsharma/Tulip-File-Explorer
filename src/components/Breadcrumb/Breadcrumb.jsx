import { useState, useMemo } from 'react';
import { splitPath, THIS_PC } from '../../utils/paths';
import './Breadcrumb.css';

function Breadcrumb({ currentPath, onNavigate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');

    const pathParts = useMemo(() => splitPath(currentPath), [currentPath]);

    const handleStartEdit = () => {
        setEditValue(currentPath === THIS_PC ? '' : currentPath);
        setIsEditing(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editValue.trim()) {
            onNavigate(editValue.trim());
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setIsEditing(false);
        }
    };

    return (
        <div className="breadcrumb">
            {isEditing ? (
                <form onSubmit={handleSubmit} className="breadcrumb-form">
                    <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => setIsEditing(false)}
                        onKeyDown={handleKeyDown}
                        className="breadcrumb-input"
                        aria-label="Folder path"
                        placeholder="Type a path and press Enter"
                        autoFocus
                    />
                </form>
            ) : (
                <div className="breadcrumb-path" onClick={handleStartEdit}>
                    <span className="breadcrumb-icon">📁</span>
                    {currentPath === THIS_PC ? (
                        <span className="breadcrumb-part">This PC</span>
                    ) : pathParts.length === 0 ? (
                        <button
                            className="breadcrumb-part"
                            onClick={(e) => {
                                e.stopPropagation();
                                onNavigate(currentPath || '/');
                            }}
                        >
                            Root
                        </button>
                    ) : (
                        pathParts.map((part, index) => (
                            <span key={part.path} className="breadcrumb-segment">
                                {index > 0 && <span className="breadcrumb-separator">›</span>}
                                <button
                                    className="breadcrumb-part"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onNavigate(part.path);
                                    }}
                                >
                                    {part.name}
                                </button>
                            </span>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default Breadcrumb;
