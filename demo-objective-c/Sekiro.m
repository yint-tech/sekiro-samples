#import <Foundation/Foundation.h>
#include "Sekiro.h"
#include <sys/socket.h>
#include <sys/types.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#import <SystemConfiguration/SystemConfiguration.h>

@interface SekiroCommonRes: NSObject
- (SekiroCommonRes *)ok:(NSData *)d;
- (SekiroCommonRes *)failed:(NSString *)m;
- (NSMutableData *)encode;
@end

@interface SekiroPacket: NSObject
@property int messegeType;
@property int seq;
@property(copy) NSData *data;
- (void)add_header:(NSString *)k value:(NSString *)v;
- (void)read_from:(NSData *)v;
- (void)write_to:(int)s;
@end

#define MAGIC 0x73656b69726f3031LL

static int unpack_data(uint8_t *buf, int offset, int width)
{
    int a = 0;

    if (width == 1) {
        a = (int8_t) buf[offset];
    } else if (width == 4) {
        a = (int32_t) OSReadBigInt32(buf, offset);
    }
    return a;
}

static NSString *unpack_string(uint8_t *buf, int offset, int length)
{
    NSString *str = [[NSString alloc] initWithBytes:buf+offset
                                              length:length
                                            encoding:NSUTF8StringEncoding];
    return str;
}

static void pack_b1(NSMutableData *d, int val)
{
    uint8_t val1 = val;
    [d appendBytes:&val1 length:1];
}

static void pack_b4(NSMutableData *d, int val)
{
    uint8_t val1[4] = { 0 };
    OSWriteBigInt32(val1, 0, val);
    [d appendBytes:&val1 length:4];
}

static void pack_b8(NSMutableData *d, int64_t val)
{
    uint8_t val1[8] = { 0 };
    OSWriteBigInt64(val1, 0, val);
    [d appendBytes:&val1 length:8];
}

@implementation SekiroPacket {
    NSMutableDictionary *headers;
}

@synthesize messegeType, seq, data;

- (SekiroPacket *)init {
    data = nil;
    headers = [[NSMutableDictionary alloc] init];
    messegeType = -1;
    seq = -1;

    return self;
}

- (void)add_header:(NSString *)k value:(NSString *)v {
    headers[k] = v;
}

- (void)read_from:(NSData *)b {
    int offset = 0;
    int header_size = 0;

    uint8_t *buf = (uint8_t *) [b bytes];
    messegeType = unpack_data(buf, 0, 1);
    seq = unpack_data(buf, 1, 4);
    header_size = unpack_data(buf, 5, 1);
    offset = 6;
    
    for (int i = 0; i < header_size; i++) {
        int key_len = unpack_data(buf, offset, 1);
        offset += 1;
        NSString * key = unpack_string(buf, offset, key_len);
        offset += key_len;
        
        int val_len = unpack_data(buf, offset, 1);
        offset += 1;
        NSString * val = unpack_string(buf, offset, val_len);
        offset += val_len;
        [self add_header:key value:val];
    }
    
    if (offset < [b length]) {
        data = [b subdataWithRange: NSMakeRange(offset, [b length] - offset)];
    }
}

- (void)write_to:(int)s {
    int length = 6;
    NSMutableData *header_data = [[NSMutableData alloc] init];

    for (NSString *k in [headers keyEnumerator]) {
        NSUInteger key_len = [k lengthOfBytesUsingEncoding:NSUTF8StringEncoding];
        NSString *v = headers[k];
        NSUInteger val_len = [v lengthOfBytesUsingEncoding:NSUTF8StringEncoding];
        uint8_t l = 0;
        length += 2 + key_len + val_len;
        
        l = key_len;
        [header_data appendBytes:&l length:1];
        [header_data appendBytes:[k UTF8String] length:key_len];
        l = val_len;
        [header_data appendBytes:&l length:1];
        [header_data appendBytes:[v UTF8String] length:val_len];
    }

    if (data) {
        length += [data length];
    }
    
    NSMutableData *packet_head = [[NSMutableData alloc] init];
    pack_b8(packet_head, MAGIC);
    pack_b4(packet_head, length);
    pack_b1(packet_head, messegeType);
    pack_b4(packet_head, seq);
    pack_b1(packet_head, (int) headers.count);

    write(s, [packet_head bytes], [packet_head length]);
    write(s, [header_data bytes], [header_data length]);

    if (data) {
        write(s, [data bytes], [data length]);
    }
}

@end

@implementation SekiroCommonRes {
    NSData *data;
    NSString *message;
    int status;
}

- (SekiroCommonRes *)init {
    data = nil;
    message = @"";
    status = -1;
    
    return self;
}

- (SekiroCommonRes *)ok:(NSData *)d {
    status = 0;
    message = @"";
    data = d;

    return self;
}

- (SekiroCommonRes *)failed:(NSString *)m {
    status = -1;
    message = m;
    data = nil;
    
    return self;
}

- (NSMutableData *)encode {
    NSMutableData *d = [[NSMutableData alloc] init];
    NSUInteger message_len = 0;
    NSUInteger data_len = 0;

    if (message) {
        message_len = [message lengthOfBytesUsingEncoding:NSUTF8StringEncoding];
    }
    
    if (data) {
        data_len = [data length];
    }
    
    pack_b4(d, status);
    pack_b4(d, (int) message_len);

    if (message_len) {
        [d appendBytes:[message UTF8String] length:message_len];
    }
    
    pack_b4(d, (int) data_len);

    if (data_len) {
        [d appendBytes:[data bytes] length:data_len];
    }
    
    return d;
}
@end

@implementation SekiroResponse {
    int stream;
    BOOL respond;
    int seq;
    SekiroClient * sekiroClient;
}

- (SekiroResponse *)init:(int)streamVal seq:(int)seqVal sekiroClient:(SekiroClient *)sekiroClientVal {
    stream = streamVal;
    seq = seqVal;
    respond = FALSE;
    sekiroClient =sekiroClientVal;
    return self;
}

- (void)success:(NSData *)d {
    SekiroCommonRes *res = [[SekiroCommonRes alloc] init];
    [self response:[res ok:d]];
    
}

- (void)failed:(NSString *)m {
    SekiroCommonRes * res = [[SekiroCommonRes alloc] init];
    [self response:[res failed:m]];
}

- (void)response:(SekiroCommonRes *)r {
    if (respond)
        return;
    respond = TRUE;
    
    SekiroPacket *p = [[SekiroPacket alloc] init];
    [p setSeq: seq];
    [p setMessegeType: 0x11];
    [p add_header:@"PAYLOAD_CONTENT_TYPE"
            value:@"CONTENT_TYPE_SEKIRO_FAST_JSON"];
    [p setData:[r encode]];
    
    @synchronized (sekiroClient) {
        // 同一个client，保证只能有一个线程在写回包
        [p write_to:stream];
    }
}

@end


@implementation SekiroClient {
    NSString *group;
    NSString *host;
    int port;
    NSString *clientId;
    NSMutableDictionary *handlers;
    BOOL started;
}

- (SekiroClient *)init:(NSString *)groupVal host:(NSString *)h port:(int)p clientId:(NSString *)c {
    group = groupVal;
    host = h;
    port = p;
    clientId = c;
    handlers = [[NSMutableDictionary alloc] init];
    started = FALSE;
    NSLog(@"   \nwelcome to use sekiro framework\n for more support please visit our website: https://iinti.cn");
    
    return self;
}

- (SekiroClient *)init:(NSString *)groupVal {
    NSString *uuid = [[[NSUUID alloc] init] UUIDString];
    NSLog(@"UUID %@", uuid);
    return [self init:groupVal host:@"sekiro.iinti.cn" port:5612 clientId:uuid];
}

- (SekiroPacket *)makeRegister {
    SekiroPacket *command = [[SekiroPacket alloc] init];
    [command setMessegeType: 0x10];
    [command setSeq: -1];
    [command add_header: @"SEKIRO_GROUP" value: group];
    [command add_header: @"SEKIRO_CLIENT_ID" value: clientId];

    return command;
}

- (SekiroHandler)getHandler:(NSString *)action {
    if ([handlers objectForKey:action]) {
        return (SekiroHandler)[handlers[action] pointerValue];
    }
    return NULL;
}

- (void)registerAction:(NSString *)act handler:(SekiroHandler)handle {
    handlers[act] = [NSValue valueWithPointer:handle];
}

- (int)makeClient {
    struct addrinfo hints;
    struct addrinfo * result, * rp;
    int s;
    int socket_fd = -1;

    memset(&hints, 0, sizeof(struct addrinfo));
    hints.ai_canonname = NULL;
    hints.ai_addr = NULL;
    hints.ai_next = NULL;
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;
    
    NSNumber * service = [[NSNumber alloc] initWithInt:port];
    
    s = getaddrinfo(host.UTF8String, service.stringValue.UTF8String, &hints, &result);
    if (s != 0) {
        NSLog(@"failed to get addrinfo");
        return -1;
    }
    
    for (rp = result; rp != NULL; rp = rp->ai_next) {
        socket_fd = socket(rp->ai_family, rp->ai_socktype, rp->ai_protocol);

        if (socket_fd == -1)
            continue;
        
        if (connect(socket_fd, rp->ai_addr, rp->ai_addrlen) != -1)
            break;
        
        close(socket_fd);
    }
    
    freeaddrinfo(result);

    if (rp == NULL)
        return -1;
    return socket_fd;
}

- (NSData *)readStream:(int) stream length:(int)len {
    uint8_t buffer[1024];
    NSMutableData *data = [[NSMutableData alloc] init];
    int read_len = 0;
    while (len > 0){
        if (len > 1024) {
            read_len = 1024;
        } else {
            read_len = len;
        }
        read(stream, buffer, read_len);
        [data appendBytes:&buffer length:read_len];
        len -= read_len;
    }
    return data;
}
- (BOOL)currentNetworkStatus {
    BOOL connected;
    BOOL isConnected;
    SCNetworkReachabilityRef reachability = SCNetworkReachabilityCreateWithName(NULL, host.UTF8String);
    SCNetworkReachabilityFlags flags;
    connected = SCNetworkReachabilityGetFlags(reachability, &flags);
    isConnected = NO;
    isConnected = connected && (flags & kSCNetworkFlagsReachable) && !(flags & kSCNetworkFlagsConnectionRequired);
    CFRelease(reachability);

    return isConnected;
}

-(void) loop{
    while (true) {
        BOOL status = [self currentNetworkStatus];
        if (status)
            [self run_sekiro_connection];
        else {
            [NSThread sleepForTimeInterval:5];
            NSLog(@"connection lost, try to connect ...");
        }
    }
}


- (void)run_sekiro_connection {
    int stream = [self makeClient];
    if (stream != -1) {
        uint8_t buffer[8];
        NSLog(@"connected to %@:%d", host, port);
        [[self makeRegister] write_to:stream];
        while (true) {
            uint64_t magic;
            uint32_t length;
            read(stream, &buffer, 8);
            magic = OSReadBigInt64(buffer, 0);
            NSLog(@"read magic");
            if (magic != MAGIC) {
                NSLog(@"protocol error, magic1 expected:%lld actually: %lld", MAGIC, magic);
                close(stream);
                break;
            }
            read(stream, &buffer, 4);
            length = OSReadBigInt32(buffer, 0);
            
            NSData *body_data = [self readStream:stream length:length];
            SekiroPacket *packet = [[SekiroPacket alloc] init];
            [packet read_from:body_data];
            [self onPacketRead:packet stream:stream];
        }
    }
}

- (void)start {
    if (started) {
        return;
    }
    started = true;
    NSThread *thread = [[NSThread alloc]initWithTarget:self selector:@selector(loop) object:nil];
    thread.name = @"sekiro-main-thread";
    [thread start];
}

- (void)onPacketRead:(SekiroPacket *)p stream:(int)s {
    int messageType = [p messegeType];
    if (messageType == 0x00) {
        [p write_to:s];
        return;
    }

    if (messageType != 0x20) {
        NSLog(@"unknown server msg:%d", messageType);
        return;
    }

    SekiroResponse *response = [[SekiroResponse alloc] init:s seq:[p seq] sekiroClient:self];

    if (![p data]) {
        [response failed:@"sekiro system error, no request payload present!!"];
        return;
    }

    NSString *request = [[NSString alloc] initWithData:[p data] encoding:NSUTF8StringEncoding];
    NSLog(@"sekiro receive request: %@", request);
    NSDictionary * request_dict = [NSJSONSerialization JSONObjectWithData:[p data]
                                                                  options:NSJSONReadingJSON5Allowed
                                                                    error:NULL];
    NSString *action = [request_dict objectForKey:@"action"];

    if (!action) {
        [response failed:@"the param: {action} not presented!!"];
        return;
    }

    SekiroHandler handler = [self getHandler:action];

    if (!handler) {
        [response failed:@"sekiro no handler for this action"];
        return;
    }
    handler(request_dict, response);
}

@end
