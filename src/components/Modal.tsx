import * as React from 'react';

export default function Modal({ style, onClose, children }) {
    return (
        <div
            style={{
                position: 'fixed',
                width: '100%',
                height: '100%',
                top: 0,
                left: 0,
                zIndex: 20,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    overflow: 'scroll',
                }}
                onClick={onClose}
            >
                <div
                    style={{
                        margin: '50px auto',
                        padding: 20,
                        borderRadius: 5,
                        backgroundColor: 'white',
                        ...style,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {children}
                </div>
            </div>
            <div
                style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    top: 0,
                    left: 0,
                    backgroundColor: 'black',
                    opacity: 0.6,
                    zIndex: -1,
                }}
            />
        </div>
    );
}
