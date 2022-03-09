# 使用MQTT协议基于阿里云平台实现物联网传输的云端串口调试助手

> 2021/8/25
> [阿里云MQTT-SDK链接](https://github.com/aliyun/alibabacloud-iot-device-sdk)

## 简述

开发这个基于阿里云平台的物联网串口调试助手用于给出一个物联网通信的解决方案，开发目的主要用于准备电赛通信类赛题。小程序从一开始串口文本接收到波形显示，再到数据流乱序纠错的实现经过层层迭代，可以实现串口通信调试和自定义数据帧的波形显示，且具有一定的纠错和还原能力。小程序耗时半个月完成，零基础开发，文章可能在部分功能模块或者语义上产生错误，恳请指出不足。

## 总体设计方案

小程序是基于`移远QUECTEL BC260Y-CN`的NB-IOT物联网模块进行基础设计开发，该模块支持`阿里云物联网平台`，这里使用MQTT协议和阿里云进行连接。首先物联网模块和微信小程序都要和阿里云物联网平台进行连接，连接成功后，阿里云平台通过规则转发使得两个设备通过`Topic`进行消息转发，实现双向通信，在小程序端需要对物联网模块上传的消息进行读取显示，在波形图功能中需要对数据进行处理，提取数据帧中的信息，以上是小程序最重要的两个功能。

## 功能设计方案

### 串口文本通信部分

类似于`sscom`这样的软件，普通的串口调试助手都会有各种设置参数（波特率，控制位，端口号等），在这个云端串口的小程序中，由于不像底层硬件那样要约定各种通信标准，`NB-IOT`物联网模块可以通过`AT指令`实现与阿里云物联网平台的连接，`NB-IOT`模块串口收发都采用文本模式收发，所以在收发数据的格式上，就直接采用文本，即字符串的格式。所以在功能需求上，就直接采用常见的社交通讯软件的使用方式，即底部一条发送框，剩余部分用作消息接收框。

功能逻辑部分主要就是在小程序页面加载时配置好与阿里云物联网平台的连接参数，发送连接请求后，开始侦听连接成功事件。在渲染完成后继续侦听异常事件和消息事件。当数据从物联网模块发送出去后，又经过平台的转发，小程序接收到消息后就会触发消息事件，然后需要做的功能就是显示具体的文本内容。如果小程序发送的消息所在的`Topic`并不是平台支持的`Topic`，或者消息格式是平台不支持的格式。则会产生异常消息，小程序在触发异常事件后应该关闭与阿里云平台的连接，这样避免导致未知问题。

在双向收发中，最好使用缓存区的概念处理通信数据，将发送的数据放到发送缓存区，触发发送事件后直接将缓存区的内容发送出去，然后立即清空发送缓存区。接收同理，数据接收到后先放到接收缓存区，然后将重要的信息提取出来，处理完成之后就可以不用关心接收缓存区中的消息了，在下次消息接收之后会自动将先前的接收缓存区内容覆盖。

### 波形图显示部分

数据需要以帧的形式进行发送，这样方便处理。一般帧包括帧头，数据和尾部校验，常见的通信协议基本都是这样的结构。由于这里使用物联网模块，`MQTT`是基于`TCP`封装而成的一个轻量化通信协议。由于他本身使用`TCP`协议进行通信，这样可以在帧的结构中把尾部校验给去掉。保留帧头用于区分不同的数据帧。所以明确了数据帧的收发格式只有帧头和数据。通过帧头识别数据内容的起始位置，用于读取数据信息。需要注意的是，由于受到网络环境，设备硬件等影响，数据如果每次发送一帧则因以上等元婴导致延迟在不断的增大，所以这里采用一次发送多帧数据，小程序使用一次接收多帧数据并同时提取数据帧中的数据。在数据帧提取完成之后保存到数据帧的缓存区，打开波形图就从数据帧缓存区中读取信息，直接画出波形图。

在绘制波形图中，需要事先规划每一帧的位置和幅值的显示缩放问题。这里使用（帧/格）用来表示横轴显示多少数据帧，（数值/格）表示数据在每一列帧对应的位置上具体显示在哪里，数据帧的位置不能溢出。

这里使用小程序的原生组件`canvas`来绘制波形，首先要绘制波形的范围，然后将途中的每个帧的位置提取出来，每次接收到一帧数据就将原有的波形图内容左移。这里需要注意`canvas`组件画线，画完之后就不能进行平移，旋转，缩放等其他操作了。由于canvas的这种特性，导致绘制波形图需要绘制一次然后就擦除整个界面再绘制下一个波形，如此循环。其中如果接收到错误的数据帧时，仍需要不断更新波形。

## 开发问题记录（部分，此部分未整理）

### 云端串口调试助手怎么把波形图和消息结合到一起?

参考常见的串口调试助手，根据帧头识别数据帧。由于阿里云物联网平台使用文本模式，再加上`json`消息规则进行收发。在此基础上小程序只需要把字符串转换成相应的数值然后提取出来用于波形显示。所以从整体功能需求上来说，只要实现文本的消息收发模式和用于波形显示的数据帧模式。由于可能后续需要扩展蓝牙透传模式，从前端显示组件上来说，输入框和和接收框可以把蓝牙收发和阿里云平台的收发做到一起，由连接方式决定使用什么连接发送消息。

### 波形图显示怎么做能使得显示效果比较良好?

在使用阿里云平台转发的过程中，`MQTT`机制是基于`TCP`协议进行转发的，受到网络环境，设备硬件等影响，对于连续快读的采样数据流会产生很大的延迟，为了避免或者说降低这样的影响。这里使用一次传输多帧数据，小程序使用一次解析多帧数据，来尽可能地避免延迟问题。在网络可靠性方面，由于MQTT是基于TCP协议的，所以通信可靠性问题可以不用考虑。在显示波形的处理中，由于不同的方案需求，可能需要对波形进行相对的伸缩。为了实现这样的功能，使用双重网格的位置标记法来适应不同的缩放要求。

双重网络位置标记是指把波形图所在画布划分网格，这里的先划分[6 * 8]大小的网格，在每个网格中再细分显示多少帧数据。在调整波形图显示多少帧数据时，只需要调整每一列网格显示多少帧数据即可调整波形图的显示波形效果。每个格子中数据帧的位置在在初始化的时候，即在开始画背景网格图时，同时获取并保存。之后通过每个网格的起始坐标和每个网格内显示多少数据帧，算出每个网格内数据帧的偏移量，这样就可以知道每一帧在什么位置了。

### 波形图乱序怎么纠正?（早期方案）

受阿里云物联网平台影响，使用MQTT协议进行通信时，消息不会产生先入先出的效果。阿里云平台也不支持`QoS 2`，用`QoS 0`或者`QoS 1`不能直接满足排序的效果。所以要纠正排序只能在边缘设备上进行相应的协商处理。这里让发送方即物联网模块，对消息进行顺序标号(1，2，3...)，在消息接收方即小程序，对消息进行重新排序.

- 排序纠正算法的实现设计如下

> 默认没有排序操作接收到消息的序号排列
> 
> 0 2 3 1 4 7 1 5 6 0 2 3 4 5 6 7 0 1 4 3 2 5 6 7
> 
> 纠正后的排序
> 
> 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7

这里的消息编号是按照7的模进行转发的，这里会产生许多排序方法的设计问题。例如: 如何识别当前周期; 如何进行相应周期长度的内容排序; 每次操作怎么处理让延时的影响较小等等其他各种问题.

首先确保可靠性以及考虑我们接收数据都是一次消息接收并不是多次消息接收，所以在处理数据帧的时候需要考虑缓存的设计必须是一次消息的操作并不是一个窗口操作。既然是每次只接收到一次消息，那么可以在每次接收消息的时候判断这个消息是不是上一个消息的下一个消息，如果是那就对本次接收到的消息进行数据帧信息提取，如果不是那就存放到相应的缓存，在等到之前的消息已经都接收处理完成之后就可以从缓存中提取出来然后处理显示。



数据从MCU传送到阿里云经过转发后被微信小程序接收后，出现如下问题

1. **延时的可靠性问题!!!**
2. 如果发送速率到达一定程度之后，不能确保接收方的数据信息顺序
3. 微信小程序受限于发送设备，传输网络，接收设备等不同的环境因素影响，使得不能接收快速连续发送的数据(1ms一次)

## 解决方案（早期方案，待完善）

问题关键是**保证数据波形的完整性**，保证数据延时可靠性，再此基础上的保证低延时效果

0. 这里针对延时可靠性问题不做讨论，首先确保数据接收后的信息处理问题
1. 发送方使用模块反馈检测，对数据进行简单的顺序保护
2. 综合解决
   - 一次接收多帧数据
   - **1个像素点对应一帧(这是最小单位，不可再缩放)**
     - 例子
       - 如果选用100kHz的高频信号进行传输，首先一次发送多个数据帧，这里`假设1次发送100帧`.
       - 基于以上假设，可以知道接收每次间隔1ms，这里有一个问题，设备硬件条件和环境条件影响，`不能达到这么一个稳定的条件`。所以肯定会产生一定的数据丢失，如果数据丢失这里就维持之前的数据信息，但是如果这样执行，就需要注意，在没有数据传输的时候就不能维持之前的数据状态，问题就是出现在这里。
       - 针对以上问题，使用以一个像素作为一次接收，且同时作为屏幕显示中的最小单位。在调整显示宽度的时候，对一组像素使用宽度缩放（`如何缩放?`）
       - 如何缩放？
         - 将采样率绑定数据帧，规定像素点之间的距离表示对应的时间长度
         - 不考虑任何情况，直接接收，**且每次接收的一次数据中多帧中的某一帧对应一个像素点**，通过调整宽度比例来改变范围，**这样的方法没有缩放功能**
     - 不是示波器，应该是**具有波形显示的界面**
     - 一个采样率对应接收一段数据帧的数量
     - 一格时间长度，根据时间对应
