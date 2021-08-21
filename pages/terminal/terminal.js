// pages/terminal/terminal.js
const iot = require('../../utils/alibabacloud-iot-device-sdk.min.js'); // 调用阿里云物联网平台SDK
const util = require('../../utils/util'); // 调用自定义工具包

Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 阿里云物联网平台信息
    aliyun: {
      productKey: 'a1uDuPpJgXx',
      deviceName: 'WeChat',
      deviceSecret: '9e445b1e2d240df50abe892c715c6c9b',
      device: {},
      topic: {
        tx: 'a1uDuPpJgXx/WeChat/user/tx',
        rx: 'a1uDuPpJgXx/WeChat/user/rx'
      },
      linkState: false // 微信小程序与阿里云IOT平台连接状态
    },

    bluetooth: {
      linkState: false
    },
    // 收发消息日志
    msg: {
      log: [
        {
          seq: 'seq0', // 消息序列号
          time: util.formatTime(new Date()), // 消息更新时间
          text: '设备已启动!' // 设备启动初始化消息
        }
      ],
      sendBuffer: '',
      receiveBuffer: '',
      nowSeq: 'seq0'
    },

    // 更多功能页面参数配置
    morePage: {
      popup: false, // 是否弹出更多功能页面
      typeEnable: true, // 是否启动更多功能页面数数据类型切换
      typeMode: 'text', // 文本模式[text]和数据帧模式[frame]选择
      frameEnable: false, // 是否开启数据帧参数设置
      frameHead: 'AABB', // 数据帧默认初始化帧头设置
      frameAlign: 'big' // 数据帧默认对其方式设置[大端对齐]
    },

    // 波形图显示界面参数设置
    scope: {
      ready: false, // 波形图界面渲染是否完成
      buttonEnable: false, // 是否开启显示波形图
      buttonType: 'warn', // 波形图开关按钮样式
      settingType: [ // 波形图显示picker组件参数设置
        ['10帧/格', '20帧/格', '30帧/格', '40帧/格', '50帧/格', '60帧/格', '70帧/格'], // X轴一格显示的帧数
        ['64/格', '128/格', '256/格', '512/格', '1024/格', '2048/格', '4096/格', '8192/格'] // Y轴一格显示的帧数
      ],
      settingData: [ // 对应picker组件的实际数据
        [10, 20, 30, 40, 50, 60, 70], // 每个格子显示的指定帧数
        [256, 512, 1024, 2048, 4096, 8192, 16384, 32768] // Y轴最大刻度
      ],
      settingIndex: [0, 0], // 波形图初始化默认设置数组下标
      map: [], // 波形显示缓存区
      frameBuffer: [], // 数据帧缓存区
      canvas: { // canvas画布参数设置
        node: {}, // 公开canvas画布实例信息
        context: {}, // 公开canvas上下文信息
        padding: 10, // 波形图边界与显示区域的边距
        axis: [], // canvas波形图自定义边界
        div: {
          blockX: 6, // canvas画布网格X轴分割的数量
          blockY: 8, // canvas画布网格Y轴分割的数量
        },
        offset: 0, // canvas波形图帧偏移量
        frameMax: 0 // canvas波形图最大可视帧数
      }
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    console.log('正在加载', '开始连接');
    this.aliyunConnect();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    console.log('渲染完成', '开始侦听');
    this.aliyunLinkDetect();
    this.aliyunReceiveMsg();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    wx.hideHomeButton();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    this.aliyunDisconnect();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  },

  /**
   * 自定义的无效无参空函数, 用于仅触发单个事件, 不绑定具体函数事件
   */
  invalid() { },

  // ========================= msg 相关函数 =========================

  /**
   * 更新消息
   * @param {string} msgText 
   */
  msgUpdate(msgText) {
    let msg = this.data.msg;
    msg.log = msg.log.concat([{
      seq: 'seq' + msg.log.length.toString(),
      time: util.formatTime(new Date()),
      text: msgText.toString()
    }]);
    msg.nowSeq = 'seq' + String(msg.log.length - 1);
    this.setData({ msg });
    // console.log('消息记录已更新', msg.log);
  },

  /**
   * 输入消息保存至缓存区
   * @param {string} text 
   */
  msgInput(text) {
    let msg = this.data.msg;
    msg.sendBuffer = text.detail.value;
    console.log('sendBuffer:', msg.sendBuffer);
  },

  /**
   * 发送缓存区消息
   */
  msgSend() {
    let aliyun = this.data.aliyun;
    let bluetooth = this.data.bluetooth;
    if (aliyun.linkState)
      this.aliyunSendMsg();
    else if (bluetooth.linkState) { }
    console.log((aliyun.linkState == true) ? '阿里云发送' : '蓝牙发送');
  },

  /**
   * 数据帧格式下, 接收并提取一帧或者多帧数据中的数值信息
   */
  msgFrameProcess() {
    let msg = this.data.msg;
    let morePage = this.data.morePage;
    let index = [];
    let data = [];
    let i = 0, j = 0;
    let old = 0, last = 0;
    if (this.data.morePage.frameAlign == 'little')
      msg.receiveBuffer = msg.receiveBuffer.toString().split('').reverse().join('');
    let tmp = msg.receiveBuffer.indexOf(morePage.frameHead);
    while (tmp != -1) {
      index[i++] = tmp;
      last = tmp;
      if (old < last) {
        data[j++] = parseInt(msg.receiveBuffer.toString().substring(old + morePage.frameHead.length, last));
        if (isNaN(data[j - 1]))
          data[j - 1] = 0;
      }
      tmp = msg.receiveBuffer.indexOf(morePage.frameHead, tmp + 1);
      old = last;
    };
    if ((old == last && last) || !last) {
      data[j] = parseInt(msg.receiveBuffer.toString().substring(last + morePage.frameHead.length));
      if (isNaN(data[j]) && tmp == -1)
        data[j] = 0;
    }
    return {
      len: index.length,
      seq: index,
      value: data
    };
  },

  // ========================= aliyun 相关函数 =========================

  /**
   * 连接阿里云物联网平台
   */
  aliyunConnect() {
    let aliyun = this.data.aliyun;
    const device = iot.device({
      productKey: this.data.aliyun.productKey,
      deviceName: this.data.aliyun.deviceName,
      deviceSecret: this.data.aliyun.deviceSecret,
      protocol: 'wxs://'
    });
    aliyun.device = device;
    device.on('connect', () => {
      aliyun.linkState = true;
      this.setData({ aliyun });
      this.msgUpdate('阿里云物联网平台连接成功!');
      console.log('Connect Successfully!');
    });
    device.subscribe(aliyun.topic.rx);
  },

  /**
   * 断开阿里云物联网平台连接
   */
  aliyunDisconnect() {
    let aliyun = this.data.aliyun;
    aliyun.device.end();
    aliyun.linkState = false;
    this.setData({ aliyun });
    this.msgUpdate('阿里云物联网平台连接断开!');
    console.log('Disconnected!');
  },

  /**
   * 阿里云连接错误问题检测
   */
  aliyunLinkDetect() {
    let aliyun = this.data.aliyun;
    aliyun.device.on('error', (err) => {
      this.msgUpdate('阿里云物联网平台连发生错误!');
      this.aliyunDisconnect();
      console.log(err);
    })
  },

  /**
   * 阿里云物联网平台连接开关
   */
  aliyunLinkSwitch() {
    let aliyun = this.data.aliyun;
    if (!aliyun.linkState) {
      this.aliyunConnect();
      this.onReady();
    }
    else
      this.aliyunDisconnect();
  },

  /**
   * 接收阿里云物联网平台消息
   */
  aliyunReceiveMsg() {
    let aliyun = this.data.aliyun;
    let msg = this.data.msg;
    let scope = this.data.scope;
    aliyun.device.on('message', (topic, payload) => {
      msg.receiveBuffer = payload;
      this.msgUpdate(payload);
      if (scope.ready) {
        let tmp = this.msgFrameProcess();
        if (tmp.len > 0) {
          scope.frameBuffer.push.apply(scope.frameBuffer, tmp.value);
          scope.frameBuffer = scope.frameBuffer.slice(-scope.canvas.frameMax);
          this.scopeDrawWave();
          console.log(scope.frameBuffer);
        }
      }
    });
  },

  /**
   * 发送消息到阿里云物联网平台
   */
  aliyunSendMsg() {
    let aliyun = this.data.aliyun;
    let msg = this.data.msg;
    if (msg.sendBuffer.length) {
      aliyun.device.publish(aliyun.topic.tx, msg.sendBuffer);
      this.msgUpdate(msg.sendBuffer);
      msg.sendBuffer = '';
      this.setData({ msg });
    }
  },

  // ========================= morePage 相关函数 =========================

  /**
   * 更多功能页面弹出开关
   */
  morePageSwitch() {
    let morePage = this.data.morePage;
    morePage.popup = !morePage.popup;
    console.log('popup:', morePage.popup);
    this.setData({ morePage });
  },

  /**
   * 更多功能页面更改通信数据类型
   * @param {*} opt 
   */
  morePageDataTypeChange(opt) {
    let morePage = this.data.morePage;
    let scope = this.data.scope;
    morePage.typeMode = opt.detail.value;
    morePage.frameEnable = (morePage.typeMode == 'frame') ? (scope.buttonEnable = true) : (scope.buttonEnable = false);
    console.log('typeMode:', morePage.typeMode, 'frameEnable:', morePage.frameEnable);
    this.setData({ morePage, scope });
  },

  /**
   * 更多功能页面更改数据类型
   * @param {*} headText 
   */
  morePageDataFormatHeadInput(headText) {
    let morePage = this.data.morePage;
    morePage.frameHead = headText.detail.value;
    console.log('frameHead:', morePage.frameHead);
    this.setData({ morePage });
  },

  /**
   * 更多功能页面更改数据帧对齐方式
   * @param {*} opt 
   */
  morePageDataFormatAlignChange(opt) {
    let morePage = this.data.morePage;
    morePage.frameAlign = opt.detail.value;
    console.log('frameAlign:', morePage.frameAlign);
    this.setData({ morePage });
  },

  /**
   * 更多功能页面清除所有消息记录
   */
  morePageCleanMsgLog() {
    let msg = this.data.msg;
    let scope = this.data.scope;
    msg.log = [];
    scope.frameBuffer = [];
    if (scope.ready) {
      let tmp = this.msgFrameProcess();
      this.scopeDrawWave();
    }
    console.log('消息记录已清空', msg.log);
    this.setData({ msg, scope });
  },

  // ========================= scope 相关函数 =========================

  /**
   * 波形图开关
   */
  scopeSwitch() {
    let scope = this.data.scope;
    if (scope.buttonType != 'default') {
      scope.buttonType = 'default';
      scope.ready = true;
    }
    else {
      scope.buttonType = 'warn';
      scope.ready = false;
    }
    this.setData({ scope });
    if (scope.ready) {
      this.scopeInit();
      console.log('波形图已开启', scope.map);
    }
    else
      console.log('波形图已关闭');
  },

  /**
   * 波形图显示波形设置
   * @param {*} setting 
   */
  scopeSettingChangePick(setting) {
    let scope = this.data.scope;
    if (typeof (setting) != 'undefined')
      scope.settingIndex = setting.detail.value;
    scope.canvas.frameMax = scope.canvas.div.blockX * scope.settingData[0][scope.settingIndex[0]] + 1;
    scope.canvas.offset = (scope.canvas.axis[0][1] - scope.canvas.axis[0][0]) / (scope.canvas.div.blockX * scope.settingData[0][scope.settingIndex[0]]);
    this.setData({ scope });
    console.log('settingIndex:', scope.settingIndex);
    console.log('offset:', scope.canvas.offset);
    console.log('frameMax:', scope.canvas.frameMax);
  },

  /**
   * 波形图绘图初始化
   */
  scopeInit() {
    let scope = this.data.scope;
    let obj, ctx;
    wx.createSelectorQuery().select('#scope').fields({ size: true, node: true }).exec((res) => {
      obj = res[0].node;
      obj.width = res[0].width;
      obj.height = res[0].height;
      ctx = obj.getContext('2d');
      scope.canvas.node = obj;
      scope.canvas.context = ctx;
      this.scopeDrawBaseMap();
      this.scopeSettingChangePick();
      this.scopeDrawWave();
    })
  },

  /**
   * 波形图画布绘制实线
   * @param {number} x1 初始位置X坐标
   * @param {number} y1 初始位置Y坐标
   * @param {number} x2 目标位置X坐标
   * @param {number} y2 目标位置Y坐标
   * @param {string} color 实线颜色
   * @param {number} width 实线长度
   */
  scopeDrawSolidLine(x1, y1, x2, y2, color, width) {
    let ctx = this.data.scope.canvas.context;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();
  },

  /**
   * 波形图画布绘制虚线
   * @param {number} x1 初始位置X坐标
   * @param {number} y1 初始位置Y坐标
   * @param {number} x2 目标位置X坐标
   * @param {number} y2 目标位置Y坐标
   * @param {string} color 虚线颜色
   * @param {number} width 虚线长度
   */
  scopeDrawDashedLine(x1, y1, x2, y2, color, width) {
    let ctx = this.data.scope.canvas.context;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    let dx = x2 - x1;
    let dy = y2 - y1;
    let dashNum = Math.floor(Math.sqrt(dx * dx + dy * dy) / 2);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let index = 0; index < dashNum; index++) {
      let nextX = x1 + (dx / dashNum) * index;
      let nextY = y1 + (dy / dashNum) * index;
      if (index % 2)
        ctx.moveTo(nextX, nextY);
      else
        ctx.lineTo(nextX, nextY);
    }
    ctx.stroke();
    ctx.closePath();
  },

  /**
   * 波形图绘制网格背景
   */
  scopeDrawBaseMap() {
    let scope = this.data.scope;
    let ctx = this.data.scope.canvas.context;
    let pad = scope.canvas.padding;
    let axis = scope.canvas.axis;
    let obj = scope.canvas.node;
    let div = scope.canvas.div;
    axis[0] = [pad, obj.width - pad];
    axis[1] = [pad, obj.height - pad];
    let lineIntervalX = (axis[0][1] - axis[0][0]) / div.blockX;
    let lineIntervalY = (axis[1][1] - axis[1][0]) / div.blockY;
    ctx.clearRect(0, 0, obj.width, obj.height);
    for (let index = 1; index < div.blockX; index++) {
      let tmp = index * lineIntervalX + axis[0][0];
      scope.map[index] = tmp;
      this.scopeDrawDashedLine(tmp, axis[1][0], tmp, axis[1][1], 'grey', 1);
    }
    scope.map[0] = axis[0][0];
    scope.map[scope.map.length] = axis[0][1];
    for (let index = 1; index < div.blockY; index++) {
      let tmp = index * lineIntervalY + axis[1][0];
      this.scopeDrawDashedLine(axis[0][0], tmp, axis[0][1], tmp, 'grey', 1);
    }
    let middleX = (axis[0][0] + axis[0][1]) / 2;
    let middleY = (axis[1][0] + axis[1][1]) / 2;
    this.scopeDrawSolidLine(axis[0][0], axis[1][0], axis[0][1], axis[1][0], 'white', 1);
    this.scopeDrawSolidLine(axis[0][0], middleY, axis[0][1], middleY, 'white', 1);
    this.scopeDrawSolidLine(axis[0][0], axis[1][1], axis[0][1], axis[1][1], 'white', 1);
    this.scopeDrawSolidLine(axis[0][0], axis[1][0], axis[0][0], axis[1][1], 'white', 1);
    this.scopeDrawSolidLine(middleX, axis[1][0], middleX, axis[1][1], 'white', 1);
    this.scopeDrawSolidLine(axis[0][1], axis[1][0], axis[0][1], axis[1][1], 'white', 1);
  },

  /**
   * 波形图绘制数据帧波形
   */
  scopeDrawWave() {
    this.scopeDrawBaseMap();
    let scope = this.data.scope;
    let axis = scope.canvas.axis;
    let axisBase = (axis[1][1] + axis[1][0]) / 2;
    let tmpAxisAmp, lastAxisAmp;
    let tmpOffset, lastOffset;
    let k = 0;
    for (let i = 0, tmpIndex = 0; i < scope.canvas.div.blockX; i++) {
      lastOffset = scope.map[i];
      for (let j = 0; j < scope.settingData[0][scope.settingIndex[0]]; j++, tmpIndex++) {
        tmpOffset = lastOffset + scope.canvas.offset;
        if (tmpIndex + scope.frameBuffer.length < scope.canvas.frameMax - 1) {
          k++;
          tmpAxisAmp = axisBase;
        }
        else
          tmpAxisAmp = axisBase - scope.frameBuffer[tmpIndex - k] / scope.settingData[1][scope.settingIndex[1]] * (axisBase - axis[1][0]);
        if (!tmpIndex) {
          if (scope.frameBuffer.length < scope.canvas.frameMax - 1)
            lastAxisAmp = axisBase;
          else
            lastAxisAmp = axisBase - scope.frameBuffer[0] / scope.settingData[1][scope.settingIndex[1]] * (axisBase - axis[1][0]);
        }
        this.scopeDrawSolidLine(lastOffset, lastAxisAmp, tmpOffset, tmpAxisAmp, 'red', 1);
        lastAxisAmp = tmpAxisAmp;
        lastOffset = tmpOffset;
      }
    }
  }
})
