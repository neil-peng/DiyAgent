/**
 * 简单的会话ID管理器
 * 优先使用URL参数中的sessionId，否则生成随机sessionId传给后端
 */

class SessionManager {
    constructor() {
        // 优先级：URL参数 > 自动生成
        this.sessionId = this.getSessionIdFromUrl() || this.generateSessionId();
        console.log('当前会话ID:', this.sessionId);

        // 如果URL中没有sessionId，更新URL以包含当前sessionId
        this.updateUrlIfNeeded();
    }

    /**
     * 从URL参数中获取sessionId
     */
    getSessionIdFromUrl() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const sessionIdFromUrl = urlParams.get('sessionId');

            // 也支持路径参数格式: /sessionid
            const pathParts = window.location.pathname.split('/').filter(p => p);
            const sessionIdFromPath = pathParts[0];

            // 优先使用查询参数，然后是路径参数
            const sessionId = sessionIdFromUrl || sessionIdFromPath;

            if (sessionId && sessionId !== '') {
                console.log('从URL获取到会话ID:', sessionId);
                return sessionId;
            }
        } catch (error) {
            console.warn('解析URL参数时出错:', error);
        }
        return null;
    }

    /**
     * 更新URL以包含当前sessionId（如果URL中没有的话）
     */
    updateUrlIfNeeded() {
        const currentUrl = new URL(window.location.href);
        const hasSessionInUrl = currentUrl.searchParams.has('sessionId') ||
            (currentUrl.pathname !== '/' && currentUrl.pathname !== '');

        if (!hasSessionInUrl) {
            // 使用查询参数方式添加sessionId
            currentUrl.searchParams.set('sessionId', this.sessionId);
            // 使用replaceState避免在浏览器历史中添加新条目
            window.history.replaceState({}, '', currentUrl.toString());
            console.log('已更新URL包含sessionId:', currentUrl.toString());
        }
    }

    /**
     * 生成随机会话ID
     */
    generateSessionId() {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        return `session_${timestamp}_${randomStr}`;
    }

    /**
     * 获取当前会话ID
     */
    getSessionId() {
        return this.sessionId;
    }

    /**
 * 设置新的会话ID并更新URL
 */
    setSessionId(newSessionId) {
        this.sessionId = newSessionId;

        // 更新URL
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('sessionId', newSessionId);
        window.history.replaceState({}, '', currentUrl.toString());

        // 触发自定义事件通知组件更新
        window.dispatchEvent(new CustomEvent('sessionIdChanged', {
            detail: { sessionId: newSessionId }
        }));

        console.log('设置新的会话ID并更新URL:', newSessionId);
    }

    /**
     * 生成新的会话ID并更新URL
     */
    resetSessionId() {
        const newSessionId = this.generateSessionId();
        this.setSessionId(newSessionId);
        return newSessionId;
    }
}

// 创建全局实例
const sessionManager = new SessionManager();

export default sessionManager; 