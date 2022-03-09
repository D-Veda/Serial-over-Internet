// lib/popup/popup.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件的初始数据
   */
  data: {

  },

  /**
   * 组件的方法列表
   */
  methods: {
    backEvent() {
      this.triggerEvent('back');
      console.log('测试 触发成功');
    },

    /**
     * 自定义的无效无参空函数, 用于仅触发单个事件, 不绑定具体函数事件
     */
    invalid() { }
  }
})
