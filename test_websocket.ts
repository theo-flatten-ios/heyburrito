import { WebClient } from '@slack/web-api';
import WebSocket from 'ws';

const appToken = 'YOUR_SLACK_APP_TOKEN_HERE'; // 여기에 실제 SLACK_APP_TOKEN (xapp-) 값을 붙여넣으세요.

if (!appToken || appToken === 'YOUR_SLACK_APP_TOKEN_HERE') {
  console.error('SLACK_APP_TOKEN을 입력해주세요.');
  process.exit(1);
}

const web = new WebClient(appToken);

(async () => {
  try {
    console.log('apps.connections.open 호출 중...');
    const response = await web.apps.connections.open();

    if (response.ok && response.url) {
      const websocketUrl = response.url;
      console.log(`WebSocket URL 획득: ${websocketUrl}`);

      console.log('WebSocket 연결 시도 중...');
      const ws = new WebSocket(websocketUrl);

      ws.onopen = () => {
        console.log('WebSocket 연결 성공!');
        // 연결이 성공하면 5초 후 종료
        setTimeout(() => {
          console.log('WebSocket 연결 종료.');
          ws.close();
        }, 5000);
      };

      ws.onmessage = (event) => {
        console.log(`메시지 수신: ${event.data}`);
      };

      ws.onerror = (error) => {
        console.error('WebSocket 오류 발생:', error);
      };

      ws.onclose = (event) => {
        console.log(`WebSocket 연결 종료됨. 코드: ${event.code}, 이유: ${event.reason}`);
      };

    } else {
      console.error('apps.connections.open 실패:', response.error);
    }
  } catch (error) {
    console.error('API 호출 또는 WebSocket 연결 중 오류 발생:', error.data || error.message);
  }
})();
