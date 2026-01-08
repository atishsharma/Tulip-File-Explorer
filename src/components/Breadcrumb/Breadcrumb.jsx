import { useState, useMemo } from 'react';
import './Breadcrumb.css';

function Breadcrumb({ currentPath, onNavigate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');

    const pathParts = useMemo(() => {
        if (!currentPath) return [];

        const separator = currentPath.includes('\\') ? '\\' : '/';
        const parts = currentPath.split(separator).filter(Boolean);

        // Build path for each part
        return parts.map((part, index) => {
            let path;
            if (currentPath.includes('\\')) {
                // Windows
                path = parts.slice(0, index + 1).join('\\');
                if (index === 0) path += '\\';
            } else {
                // Unix
                path = '/' + parts.slice(0, index + 1).join('/');
            }

            return { name: part, path };
        });
    }, [currentPath]);

    const handleStartEdit = () => {
        setEditValue(currentPath);
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
                        autoFocus
                    />
                </form>
            ) : (
                <div className="breadcrumb-path" onClick={handleStartEdit}>
                    <span className="breadcrumb-icon">📁</span>
                    {pathParts.length === 0 ? (
                        <span className="breadcrumb-part">Root</span>
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
