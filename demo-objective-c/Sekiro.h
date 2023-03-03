#ifndef Sekiro_h
#define Sekiro_h

#import <Foundation/Foundation.h>

@interface SekiroResponse: NSObject
- (void)success:(NSData *)d;
- (void)failed:(NSString *)m;
@end

typedef void (*SekiroHandler) (NSDictionary *, SekiroResponse *);

@interface SekiroClient: NSObject
/*初始化，带全部参数*/
- (SekiroClient *)init:(NSString *)group
                  host:(NSString *)h
                  port:(int)p
              clientId:(NSString *)c;
/*初始化，连接sekiro默认测试服务器*/
- (SekiroClient *)init: (NSString *)groupVal;
/* 启动sekiro  */
- (void)start;
/* 注册处理器 */
- (void)registerAction:(NSString *)act handler:(SekiroHandler)handle;
@end

#endif /* Sekiro_h */
