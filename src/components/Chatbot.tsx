import React, { useState } from 'react';

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#22c55e',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          fontSize: '30px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 9999
        }}
      >
        🤖
      </button>

      {/* Janela do chat (simples) */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          width: '350px',
          height: '400px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          padding: '20px',
          zIndex: 9999,
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '10px' }}>🤖 Central do Buffet</h3>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Chatbot conectado! Em breve mais funcionalidades.
          </p>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              marginTop: '20px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Fechar
          </button>
        </div>
      )}
    </>
  );
};
