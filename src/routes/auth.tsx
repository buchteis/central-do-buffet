<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meu Churras - Gestão de Buffet</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary-orange: #FF6B35;
            --primary-orange-dark: #E55A2B;
            --primary-orange-light: #FFB366;
            --text-dark: #1A1A1A;
            --text-light: #666666;
            --bg-light: #F8F9FA;
            --bg-white: #FFFFFF;
            --border-color: #E0E0E0;
            --success: #10B981;
            --warning: #F59E0B;
            --error: #EF4444;
            --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
            --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background-color: var(--bg-light);
            color: var(--text-dark);
            line-height: 1.6;
        }

        .container {
            display: flex;
            height: 100vh;
        }

        /* ===== SIDEBAR ===== */
        .sidebar {
            width: 260px;
            background-color: var(--bg-white);
            border-right: 1px solid var(--border-color);
            padding: 24px 16px;
            overflow-y: auto;
            box-shadow: var(--shadow-sm);
        }

        .sidebar-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 32px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border-color);
        }

        .sidebar-logo {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, var(--primary-orange), var(--primary-orange-dark));
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 20px;
        }

        .sidebar-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-dark);
        }

        .sidebar-subtitle {
            font-size: 11px;
            color: var(--text-light);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .nav-section {
            margin-bottom: 24px;
        }

        .nav-section-title {
            font-size: 11px;
            font-weight: 700;
            color: var(--text-light);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
            padding: 0 8px;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            margin-bottom: 4px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            color: var(--text-light);
            font-size: 14px;
            text-decoration: none;
        }

        .nav-item:hover {
            background-color: var(--bg-light);
            color: var(--primary-orange);
        }

        .nav-item.active {
            background-color: rgba(255, 107, 53, 0.1);
            color: var(--primary-orange);
            font-weight: 500;
        }

        .nav-icon {
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* ===== MAIN CONTENT ===== */
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* ===== TOP BAR ===== */
        .top-bar {
            background-color: var(--bg-white);
            border-bottom: 1px solid var(--border-color);
            padding: 16px 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: var(--shadow-sm);
        }

        .search-container {
            flex: 1;
            max-width: 400px;
        }

        .search-input {
            width: 100%;
            padding: 10px 16px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            font-size: 14px;
            background-color: var(--bg-light);
            transition: all 0.3s ease;
        }

        .search-input:focus {
            outline: none;
            border-color: var(--primary-orange);
            background-color: var(--bg-white);
            box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
        }

        .top-bar-actions {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .btn {
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn-primary {
            background-color: var(--primary-orange);
            color: white;
        }

        .btn-primary:hover {
            background-color: var(--primary-orange-dark);
            box-shadow: var(--shadow-md);
        }

        .btn-secondary {
            background-color: var(--bg-light);
            color: var(--text-dark);
            border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
            background-color: var(--border-color);
        }

        /* ===== CONTENT AREA ===== */
        .content {
            flex: 1;
            overflow-y: auto;
            padding: 32px;
        }

        /* ===== HEADER SECTION ===== */
        .header-section {
            text-align: center;
            margin-bottom: 32px;
        }

        .buffet-name {
            font-size: 32px;
            font-weight: 700;
            color: var(--text-dark);
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }

        .buffet-subtitle {
            font-size: 14px;
            color: var(--text-light);
            margin-bottom: 16px;
        }

        .stats-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }

        .stat-card {
            background-color: var(--bg-white);
            border-radius: 12px;
            padding: 20px;
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border-color);
            transition: all 0.3s ease;
        }

        .stat-card:hover {
            box-shadow: var(--shadow-md);
            border-color: var(--primary-orange);
        }

        .stat-label {
            font-size: 12px;
            color: var(--text-light);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            font-weight: 600;
        }

        .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: var(--text-dark);
        }

        .stat-change {
            font-size: 12px;
            color: var(--success);
            margin-top: 8px;
        }

        /* ===== FILTERS & ACTIONS ===== */
        .filters-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 16px;
        }

        .filter-group {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .filter-btn {
            padding: 8px 16px;
            border: 1px solid var(--border-color);
            background-color: var(--bg-white);
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.3s ease;
            color: var(--text-dark);
        }

        .filter-btn:hover {
            border-color: var(--primary-orange);
            color: var(--primary-orange);
        }

        .filter-btn.active {
            background-color: var(--primary-orange);
            color: white;
            border-color: var(--primary-orange);
        }

        /* ===== TABLE ===== */
        .table-container {
            background-color: var(--bg-white);
            border-radius: 12px;
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border-color);
            overflow: hidden;
        }

        .table-header {
            display: grid;
            grid-template-columns: 1fr 1fr 1.2fr 1fr 1fr 1fr 0.8fr;
            gap: 16px;
            padding: 16px 24px;
            background-color: var(--bg-light);
            border-bottom: 1px solid var(--border-color);
            font-size: 12px;
            font-weight: 700;
            color: var(--text-light);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .table-body {
            max-height: 600px;
            overflow-y: auto;
        }

        .table-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1.2fr 1fr 1fr 1fr 0.8fr;
            gap: 16px;
            padding: 16px 24px;
            border-bottom: 1px solid var(--border-color);
            align-items: center;
            transition: all 0.3s ease;
        }

        .table-row:hover {
            background-color: var(--bg-light);
        }

        .table-row:last-child {
            border-bottom: none;
        }

        .table-cell {
            font-size: 14px;
            color: var(--text-dark);
        }

        .table-cell.text-muted {
            color: var(--text-light);
        }

        .table-cell.text-right {
            text-align: right;
        }

        .table-cell.text-center {
            text-align: center;
        }

        .badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .badge-success {
            background-color: rgba(16, 185, 129, 0.1);
            color: var(--success);
        }

        .badge-warning {
            background-color: rgba(245, 158, 11, 0.1);
            color: var(--warning);
        }

        .badge-error {
            background-color: rgba(239, 68, 68, 0.1);
            color: var(--error);
        }

        .action-buttons {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }

        .action-btn {
            width: 32px;
            height: 32px;
            border: none;
            background-color: transparent;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            color: var(--text-light);
            font-size: 16px;
        }

        .action-btn:hover {
            background-color: var(--bg-light);
            color: var(--primary-orange);
        }

        .action-btn.delete:hover {
            background-color: rgba(239, 68, 68, 0.1);
            color: var(--error);
        }

        /* ===== SCROLLBAR ===== */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: var(--bg-light);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--text-light);
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 1024px) {
            .sidebar {
                width: 200px;
            }

            .table-header,
            .table-row {
                grid-template-columns: 1fr 1fr 1fr 1fr 1fr 0.8fr;
                gap: 12px;
            }
        }

        @media (max-width: 768px) {
            .container {
                flex-direction: column;
            }

            .sidebar {
                width: 100%;
                height: auto;
                border-right: none;
                border-bottom: 1px solid var(--border-color);
                padding: 16px;
                display: flex;
                gap: 24px;
            }

            .sidebar-header {
                margin-bottom: 0;
                padding-bottom: 0;
                border-bottom: none;
            }

            .nav-section {
                display: flex;
                gap: 16px;
                margin-bottom: 0;
            }

            .nav-section-title {
                display: none;
            }

            .content {
                padding: 16px;
            }

            .buffet-name {
                font-size: 24px;
            }

            .table-header,
            .table-row {
                grid-template-columns: 1fr 1fr 1fr;
                gap: 8px;
            }

            .stats-container {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- SIDEBAR -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">🔥</div>
                <div>
                    <div class="sidebar-title">Meu Churras</div>
                    <div class="sidebar-subtitle">Gestão de Buffet</div>
                </div>
            </div>

            <nav class="nav-section">
                <a href="#" class="nav-item active">
                    <span class="nav-icon">📊</span>
                    <span>Dashboard</span>
                </a>
                <a href="#" class="nav-item">
                    <span class="nav-icon">📋</span>
                    <span>Orçamentos</span>
                </a>
                <a href="#" class="nav-item">
                    <span class="nav-icon">📅</span>
                    <span>Eventos</span>
                </a>
                <a href="#" class="nav-item">
                    <span class="nav-icon">📝</span>
                    <span>Contratos</span>
                </a>
                <a href="#" class="nav-item">
                    <span class="nav-icon">🎁</span>
                    <span>Pacotes</span>
                </a>
                <a href="#" class="nav-item">
                    <span class="nav-icon">📦</span>
                    <span>Estoque</span>
                </a>
                <a href="#" class="nav-item">
                    <span class="nav-icon">👥</span>
                    <span>Clientes</span>
                </a>
                <a href="#" class="nav-item">
                    <span class="nav-icon">💼</span>
                    <span>Profissionais</span>
                </a>
            </nav>

            <div class="nav-section">
                <div class="nav-section-title">Administração</div>
                <a href="#" class="nav-item">
                    <span class="nav-icon">⚙️</span>
                    <span>Configurações</span>
                </a>
                <a href="#" class="nav-item">
                    <span class="nav-icon">👑</span>
                    <span>Super Admin</span>
                </a>
            </div>
        </aside>

        <!-- MAIN CONTENT -->
        <div class="main-content">
            <!-- TOP BAR -->
            <header class="top-bar">
                <div class="search-container">
                    <input type="text" class="search-input" placeholder="🔍 Buscar cliente, orçamento...">
                </div>
                <div class="top-bar-actions">
                    <button class="btn btn-secondary">📋 Copiar link</button>
                    <button class="btn btn-primary">+ Novo Orçamento</button>
(Content truncated due to size limit. Use line ranges to read remaining content)
