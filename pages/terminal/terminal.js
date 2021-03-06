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
        tx: '/a1uDuPpJgXx/WeChat/user/tx',
        rx: '/a1uDuPpJgXx/WeChat/user/rx'
      },
      linkState: false // 微信小程序与阿里云IOT平台连接状态
    },

    // 蓝牙设备信息
    bluetooth: {
      discoveryState: false, // 蓝牙搜索状态
      linkState: false, // 蓝牙连接状态
      adapterEnable: false, // 蓝牙适配器是否可用
      listEnable: false
    },

    // 收发消息参数
    msg: {
      log: [
        {
          seq: 'seq0', // 消息序列号
          time: util.formatTime(new Date()), // 消息更新时间
          text: '设备已启动!' // 设备启动初始化消息
        }
      ],
      bufferMax: 100, // 最大保存消息数量
      sendBuffer: '',
      receiveBuffer: '',
      nowSeq: 'seq0',
      seqMsg: [],
      frameSafeBuffer: [], // 数据帧安全模式缓存区
      frameSafeNextLabel: [], // 数据帧安全模式远程标签缓存区
      frameSafeLabelNow: 0, // 默认初始值为0
      frameSafeTTLNow: 0
    },

    // 更多功能页面参数配置
    morePage: {
      popup: false, // 是否弹出更多功能页面
      typeEnable: true, // 是否启动更多功能页面数数据类型切换
      typeMode: 'text', // 文本模式[text]和数据帧模式[frame]选择
      frameEnable: false, // 是否开启数据帧参数设置
      frameHead: 'AABB', // 数据帧默认初始化帧头设置
      frameAlign: 'big', // 数据帧默认对其方式设置[大端对齐]
      frameSafeEnable: false, // 数据帧默认关闭安全模式
      frameSafeTrigger: false, // 数据帧安全模式的起点触发器
      frameSafeMod: 8, // 数据帧安全模式的精度[谨慎调整]
    },

    // 波形图显示界面参数设置
    scope: {
      ready: false, // 波形图界面渲染是否完成
      buttonEnable: false, // 是否开启显示波形图
      buttonType: 'warn', // 波形图开关按钮样式
      settingType: [ // 波形图显示picker组件参数设置
        ['10帧/格', '20帧/格', '30帧/格', '40帧/格', '50帧/格', '60帧/格', '70帧/格', '80帧/格', '90帧/格', '100帧/格'], // X轴一格显示的帧数
        ['64/格', '128/格', '256/格', '512/格', '1024/格', '2048/格', '4096/格', '8192/格'] // Y轴一格显示的帧数
      ],
      settingData: [ // 对应picker组件的实际数据
        [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], // 每个格子显示的指定帧数
        [256, 512, 1024, 2048, 4096, 8192, 16384, 32768] // Y轴最大刻度
      ],
      settingIndex: [0, 0], // 波形图初始化默认设置数组下标
      map: [], // 波形图点显示位置缓存区
      frameBuffer: [], // 数据帧缓存区
      canvas: { // canvas画布参数设置
        ready: false, // canvas画布是否初始化完成
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
    this.popup = this.selectComponent("#popup");
    console.log('正在加载', '开始连接');
    this.aliyunConnect();
    this.bluetoothOpen();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    console.log('渲染完成', '开始侦听');
    this.aliyunLinkDetect();
    this.aliyunReceiveMsg();
    this.bluetoothDetect();
    this.bluetoothDiscovery();
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
    this.bluetoothClose();
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
   * 更新显示消息
   * @param {string} msgText 消息更新内容
   */
  msgUpdate(msgText) {
    let msg = this.data.msg;
    msg.log = msg.log.concat([{
      seq: 'seq' + msg.log.length.toString(),
      time: util.formatTime(new Date()),
      text: msgText.toString()
    }]).slice(-msg.bufferMax);
    msg.nowSeq = 'seq' + String(msg.log.length - 1);
    this.setData({ msg });
    console.log('消息记录已更新', msg.log);
  },

  /**
   * 更多功能页面清除所有消息记录
   */
  msgClean() {
    let msg = this.data.msg;
    let scope = this.data.scope;
    let morePage = this.data.morePage;
    msg.log = [];
    scope.frameBuffer = [];
    if (scope.canvas.ready)
      this.scopeDrawWave();
    if (morePage.frameSafeEnable)
      morePage.frameSafeTrigger = true;
    this.setData({ msg, scope });
    console.log('消息记录已清空', msg.log);
  },

  /**
   * 输入消息保存至缓存区
   * @param {string} text 消息文本
   */
  msgInput(text) {
    let msg = this.data.msg;
    msg.sendBuffer = text.detail.value;
    console.log('发送缓存区', msg.sendBuffer);
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
   * 数据帧格式下, 从接收缓存区提取一帧或者多帧数据中的数值信息
   */
  msgFrameProcess() {
    let msg = this.data.msg;
    let morePage = this.data.morePage;
    let index = [];
    let data = [];
    let i = 0, j = 0;
    let last = 0, now = 0;
    if (this.data.morePage.frameAlign == 'little')
      msg.receiveBuffer = msg.receiveBuffer.toString().split('').reverse().join('');
    let tmp = msg.receiveBuffer.indexOf(morePage.frameHead);
    while (tmp != -1) {
      index[i++] = tmp;
      now = tmp;
      if (last < now) {
        data[j++] = parseInt(msg.receiveBuffer.toString().substring(last + morePage.frameHead.length, now));
        if (isNaN(data[j - 1]))
          j--;
      }
      tmp = msg.receiveBuffer.indexOf(morePage.frameHead, tmp + 1);
      last = now;
    };
    if ((last == now && now) || !now) {
      data[j] = parseInt(msg.receiveBuffer.toString().substring(now + morePage.frameHead.length));
      if (isNaN(data[j]) && tmp == -1)
        data[j] = 0;
    }
    return {
      len: index.length,
      value: data
    };
  },

  /**
   * 数据帧格式下, 从接收缓存区提取帧数据, 并通过消息序号对数据帧进行纠正排序, 返回纠错完成的数据帧信息
   */
  msgFrameSafeProcess() {
    let msg = this.data.msg;
    let morePage = this.data.morePage;
    let data = [];
    let tmpLocal = parseInt(msg.receiveBuffer.toString());
    let tmpRemote = msg.receiveBuffer.toString().indexOf("#");
    let tmpIndex = 0;
    if (tmpRemote != -1)
      tmpRemote = parseInt(msg.receiveBuffer.toString().substring(tmpRemote + 1));
    if (morePage.frameSafeTrigger) {
      morePage.frameSafeTrigger = false;
      msg.frameSafeLabelNow = tmpLocal;
      msg.frameSafeTTLNow = morePage.frameSafeMod;
    }
    if (!msg.frameSafeTTLNow) {
      data.push.apply(data, [0]);
      msg.frameSafeLabelNow = msg.frameSafeNextLabel.findIndex((value, index) => {
        return (index > msg.frameSafeLabelNow) ? !isNaN(value) : false;
      });
      if (msg.frameSafeLabelNow == undefined)
        msg.frameSafeLabelNow = msg.frameSafeNextLabel.findIndex((value) => {
          return !isNaN(value);
        })
      if (msg.frameSafeLabelNow == undefined)
        msg.frameSafeLabelNow = tmpLocal;
      msg.frameSafeTTLNow = morePage.frameSafeMod;
    }
    msg.frameSafeBuffer[tmpLocal] = this.msgFrameProcess().value;
    msg.frameSafeNextLabel[tmpLocal] = tmpRemote;
    while (msg.frameSafeBuffer[msg.frameSafeLabelNow] != null) {
      tmpIndex++;
      data.push.apply(data, msg.frameSafeBuffer[msg.frameSafeLabelNow]);
      msg.frameSafeBuffer[msg.frameSafeLabelNow] = null;
      msg.frameSafeLabelNow = msg.frameSafeNextLabel[msg.frameSafeLabelNow];
      if (msg.frameSafeLabelNow == -1) {
        morePage.frameSafeTrigger = true;
        break;
      }
    }
    if (!tmpIndex)
      msg.frameSafeTTLNow--;
    else
      msg.frameSafeTTLNow = morePage.frameSafeMod;
    return {
      len: data.length,
      value: data
    }
  },

  // ========================= aliyun 相关函数 =========================

  /**
   * 连接阿里云物联网平台
   */
  aliyunConnect() {
    let aliyun = this.data.aliyun;
    let morePage = this.data.morePage;
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
      console.log('阿里云物联网平台连接成功!');
    });
    device.subscribe(aliyun.topic.rx, { qos: 1 });
    if (morePage.frameSafeEnable)
      morePage.frameSafeTrigger = true;
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
    console.log('阿里云物联网平台连接断开!');
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
      this.aliyunLinkDetect();
      this.aliyunReceiveMsg();
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
    let morePage = this.data.morePage;
    aliyun.device.on('message', (topic, payload) => {
      msg.receiveBuffer = payload.toString();
      this.msgUpdate(payload);
      console.log('接收缓存区', msg.receiveBuffer);
      if (morePage.frameEnable) {
        let tmp;
        if (morePage.frameSafeEnable)
          tmp = this.msgFrameSafeProcess();
        else
          tmp = this.msgFrameProcess();
        if (tmp.len > 0) {
          scope.frameBuffer.push.apply(scope.frameBuffer, tmp.value);
          scope.frameBuffer = scope.frameBuffer.slice(-scope.canvas.frameMax);
          console.log('数据帧缓存区', scope.frameBuffer);
          if (scope.canvas.ready)
            this.scopeDrawWave();
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

  // ========================= bluetooth 相关函数 =========================

  bluetoothListSwitch() {
    let bluetooth = this.data.bluetooth;
    bluetooth.listEnable = !bluetooth.listEnable;
    console.log(bluetooth.listEnable)
    this.setData({ bluetooth });
  },

  bluetoothDiscovery() {
    wx.onBluetoothDeviceFound((result) => {
      result.devices.forEach((device) => {
        console.log(device);
        this.msgUpdate(device.localName.toString() + ' ' + device.RSSI.toString() + '\n' + device.deviceId.toString());
      });
    });
    // function ab2hex(buffer) {
    //   var hexArr = Array.prototype.map.call(
    //     new Uint8Array(buffer),
    //     function(bit) {
    //       return ('00' + bit.toString(16)).slice(-2)
    //     }
    //   )
    //   return hexArr.join('');
    // }
    // wx.getBluetoothDevices({
    //   success: function (res) {
    //     console.log(res)
    //     if (res.devices[0]) {
    //       console.log(ab2hex(res.devices[0].advertisData))
    //     }
    //   }
    // })
    // wx.getBluetoothDevices({
    //   success: (result) => {
    //     result.devices.forEach((device) => {
    //       console.log(device);
    //     })
    //   },
    //   complete: (result) => {
    //     result.devices.forEach((device) => {
    //       console.log(device);
    //     })
    //   }
    // })
  },

  bluetoothLinkSwitch() {
    let bluetooth = this.data.bluetooth;
    if (bluetooth.adapterEnable) {
      if (!bluetooth.discoveryState) {
        bluetooth.discoveryState = true;
        wx.startBluetoothDevicesDiscovery({
          powerLevel: 'high',
          fail: () => {
            this.msgUpdate('蓝牙设备搜索失败!');
            console.log('蓝牙设备搜索失败!');
          }
        });
      }
      else {
        bluetooth.discoveryState = false;
        wx.stopBluetoothDevicesDiscovery();
        wx.offBluetoothDeviceFound();
      }
    }
  },

  bluetoothDetect() {
    let bluetooth = this.data.bluetooth;
    wx.onBluetoothAdapterStateChange((result) => {
      if (result.available && !bluetooth.adapterEnable) {
        bluetooth.adapterEnable = true;
        this.msgUpdate('蓝牙启动成功!');
        console.log('蓝牙启动成功!');
        this.setData({ bluetooth });
      }
      else if (!result.available && bluetooth.adapterEnable) {
        bluetooth.adapterEnable = false;
        this.msgUpdate('蓝牙已关闭!');
        console.log('蓝牙已关闭!');
        this.setData({ bluetooth });
      }
      else if (result.discovering && bluetooth.discoveryState) {
        bluetooth.discoveryState = true;
        this.msgUpdate('蓝牙搜索启动!');
        console.log('蓝牙搜索启动!');
        this.setData({ bluetooth });
      } else if (!result.discovering && !bluetooth.discoveryState) {
        bluetooth.discoveryState = false;
        this.msgUpdate('蓝牙搜索停止!');
        console.log('蓝牙搜索停止!');
        this.setData({ bluetooth });
      }
    });
  },

  bluetoothOpen() {
    let bluetooth = this.data.bluetooth;
    wx.openBluetoothAdapter({
      mode: 'central',
      success: (res) => {
        bluetooth.adapterEnable = true;
        this.msgUpdate('蓝牙初始化成功!');
        console.log('蓝牙初始化成功!');
        this.setData({ bluetooth });
      },
      fail: (res) => {
        bluetooth.adapterEnable = false;
        this.msgUpdate('蓝牙不可用!');
        console.log('蓝牙不可用!');
        this.setData({ bluetooth });
      }
    });
  },

  bluetoothClose() {
    let bluetooth = this.data.bluetooth;
    bluetooth.adapterEnable = false;
    bluetooth.discoveryState = false;
    bluetooth.linkState = false;
    wx.closeBluetoothAdapter();
    this.setData({ bluetooth });
  },

  // ========================= morePage 相关函数 =========================

  /**
   * 更多功能页面弹出开关
   */
  morePageSwitch() {
    let morePage = this.data.morePage;
    morePage.popup = !morePage.popup;
    this.setData({ morePage });
    console.log('更多功能弹出', morePage.popup);
  },

  /**
   * 更多功能页面更改通信数据类型
   * @param {*} opt 事件参数
   */
  morePageDataTypeChange(opt) {
    let morePage = this.data.morePage;
    let scope = this.data.scope;
    morePage.typeMode = opt.detail.value;
    morePage.frameEnable = (morePage.typeMode == 'frame') ? (scope.buttonEnable = true) : (scope.buttonEnable = false);
    this.setData({ morePage, scope });
    console.log('数据类型', morePage.typeMode, '数据帧功能', morePage.frameEnable);
  },

  /**
   * 更多功能页面更改数据类型
   * @param {*} headText 事件参数
   */
  morePageDataFrameHeadInput(headText) {
    let morePage = this.data.morePage;
    morePage.frameHead = headText.detail.value;
    this.setData({ morePage });
    console.log('数据帧头', morePage.frameHead);
  },

  /**
   * 更多功能页面更改数据帧对齐方式
   * @param {*} opt 事件参数
   */
  morePageDataFrameAlignChange(opt) {
    let morePage = this.data.morePage;
    morePage.frameAlign = opt.detail.value;
    this.setData({ morePage });
    console.log('数据帧对齐方式', morePage.frameAlign);
  },

  /**
   * 更多功能页面数据帧安全模式开启提示
   * @param {*} opt 事件参数
   */
  morePageDataFrameSafeModeChange(opt) {
    let morePage = this.data.morePage;
    let msg = this.data.msg;
    morePage.frameSafeEnable = (opt.detail.value == 'safe') ? true : false;
    var that = this;
    if (morePage.frameSafeEnable) {
      wx.showModal({
        title: '警告',
        content: '接收格式: "[Seq][Message](#[NextSeq])" 安全模式用于对接收到的数据帧进行强制排序, 调整数值可改变纠错空间大小, 非必要请勿选择安全模式!',
        cancelText: '让我想想',
        confirmText: '我知道了',
        success(res) {
          if (res.cancel) {
            morePage.frameSafeEnable = false;
            morePage.frameSafeTrigger = false;
          }
          else if (res.confirm) {
            morePage.frameSafeEnable = true;
            morePage.frameSafeTrigger = true;
          }
          that.setData({ morePage });
          console.log('数据帧安全模式', morePage.frameSafeEnable);
        }
      })
    }
    else
      console.log('数据帧安全模式', morePage.frameSafeEnable);
  },

  /**
   * 更多功能页面数据帧安全模式参数调整
   * @param {*} opt 事件参数
   */
  morePageDataFrameSafeModeModInput(opt) {
    let morePage = this.data.morePage;
    let msg = this.data.msg;
    msg.frameSafeNumNow = 0;
    morePage.frameSafeMod = Number(opt.detail.value);
    this.setData({ morePage });
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
      scope.canvas.ready = false;
      scope.map = [];
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
   * @param {*} setting 事件参数
   */
  scopeSettingChangePick(setting) {
    let scope = this.data.scope;
    if (typeof (setting) != 'undefined')
      scope.settingIndex = setting.detail.value;
    scope.canvas.frameMax = scope.canvas.div.blockX * scope.settingData[0][scope.settingIndex[0]] + 1;
    scope.canvas.offset = (scope.canvas.axis[0][1] - scope.canvas.axis[0][0]) / (scope.canvas.div.blockX * scope.settingData[0][scope.settingIndex[0]]);
    this.setData({ scope });
    if (scope.canvas.ready)
      this.scopeDrawWave();
    console.log('波形图显示设置', scope.settingIndex, '波形图数据帧偏移量', scope.canvas.offset, '波形图最大显示帧数', scope.canvas.frameMax);
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
      scope.canvas.ready = true;
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
   * 从数据帧缓存区更新绘制波形
   */
  scopeDrawWave() {
    this.scopeDrawBaseMap();
    let scope = this.data.scope;
    let axis = scope.canvas.axis;
    let axisBase = (axis[1][1] + axis[1][0]) / 2;
    let tmpAxisAmp, lastAxisAmp;
    let tmpOffset, lastOffset;
    for (let i = 0, k = 1, tmpIndex = 1; i < scope.canvas.div.blockX; i++) {
      lastOffset = scope.map[i];
      for (let j = 0; j < scope.settingData[0][scope.settingIndex[0]]; j++, tmpIndex++) {
        tmpOffset = lastOffset + scope.canvas.offset;
        if (tmpIndex == 1) {
          if (scope.frameBuffer.length < scope.canvas.frameMax)
            lastAxisAmp = axisBase;
          else {
            lastAxisAmp = axisBase - scope.frameBuffer[0] / scope.settingData[1][scope.settingIndex[1]] * (axisBase - axis[1][0]);
            k = 0;
          }
        }
        if (tmpIndex + scope.frameBuffer.length < scope.canvas.frameMax) {
          k++;
          tmpAxisAmp = axisBase;
        }
        else
          tmpAxisAmp = axisBase - scope.frameBuffer[tmpIndex - k] / scope.settingData[1][scope.settingIndex[1]] * (axisBase - axis[1][0]);
        this.scopeDrawSolidLine(lastOffset, lastAxisAmp, tmpOffset, tmpAxisAmp, 'red', 1);
        lastAxisAmp = tmpAxisAmp;
        lastOffset = tmpOffset;
      }
    }
  }
})
