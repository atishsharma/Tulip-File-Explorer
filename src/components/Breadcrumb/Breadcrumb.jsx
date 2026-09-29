import { useState, useMemo } from 'react';
import { splitPath, THIS_PC } from '../../utils/paths';
import { LineIcon } from '../../utils/fileIcons';
import { usePlatform, computerName } from '../../hooks/usePlatform';
import './Breadcrumb.css';

function Breadcrumb({ currentPath, onNavigate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');

    const platform = usePlatform();
    const pathParts = useMemo(() => splitPath(currentPath), [currentPath]);

    // Long paths keep the root and the last three folders
    const visibleParts = useMemo(() => {
        if (pathParts.length <= 4) return pathParts;
        const hidden = pathParts.slice(1, -3);
        return [pathParts[0], { gap: true, title: hidden.map((p) => p.name).join(' › ') }, ...pathParts.slice(-3)];
    }, [pathParts]);

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
                    <span className="breadcrumb-icon">
                        <LineIcon name={currentPath === THIS_PC ? 'computer' : 'folder'} size={16} />
                    </span>
                    {currentPath === THIS_PC ? (
                        <span className="breadcrumb-part current">{computerName(platform)}</span>
                    ) : pathParts.length === 0 ? (
                        <button
                            className="breadcrumb-part current"
                            onClick={(e) => {
                                e.stopPropagation();
                                onNavigate(currentPath || '/');
                            }}
                        >
                            Root
                        </button>
                    ) : (
                        visibleParts.map((part, index) => (
                            <span key={part.path || `gap-${index}`} className="breadcrumb-segment">
                                {index > 0 && (
                                    <span className="breadcrumb-separator" aria-hidden="true">
                                        <LineIcon name="chevronRight" size={13} strokeWidth={2} />
                                    </span>
                                )}
                                {part.gap ? (
                                    <span className="breadcrumb-gap" title={part.title}>…</span>
                                ) : (
                                    <button
                                        className={`breadcrumb-part ${index === visibleParts.length - 1 ? 'current' : ''}`}
                                        aria-current={index === visibleParts.length - 1 ? 'location' : undefined}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigate(part.path);
                                        }}
                                    >
                                        {part.name}
                                    </button>
                                )}
                            </span>
                        ))
                    )}
                    <button
                        className="breadcrumb-edit"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit();
                        }}
                        title="Type a path"
                        aria-label="Type a path"
                    >
                        <LineIcon name="rename" size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}

export default Breadcrumb;
