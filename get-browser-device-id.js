// 获取浏览器中存储的设备ID
const deviceId = localStorage.getItem('manga_device_id');
console.log('浏览器中的设备ID:', deviceId);

// 如果没有设备ID，生成一个新的
if (!deviceId) {
  const newDeviceId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('manga_device_id', newDeviceId);
  console.log('生成新的设备ID:', newDeviceId);
} else {
  console.log('使用现有设备ID:', deviceId);
}
