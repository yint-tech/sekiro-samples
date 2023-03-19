//
//  main.m
//  sekiro-oc
//
//  Created by yint on 2023/3/4.
//


#import <Foundation/Foundation.h>
#include "Sekiro.h"

void test(NSDictionary *request, SekiroResponse *response) {
    // 请注意，本方法调用时异步线程，不能在这里sleep，不能做网络等耗时操作，如果有必要，请在新线程中执行
    [response success:[@"\"ok replay objective-c\""  dataUsingEncoding:NSUTF8StringEncoding]];
}

void blokingTest(NSDictionary *request, SekiroResponse *response){
    NSThread *thread = [[NSThread alloc] initWithBlock:^{
        // 这里有休眠，所以本方法不能直接在handler线程中调用，否则并发起不来
        [NSThread sleepForTimeInterval:2];

        [response success:[@"\"ok replay objective-c with blokingTest\""  dataUsingEncoding:NSUTF8StringEncoding]];
    }];
    [thread start];
}


int main(int argc, const char * argv[]) {
    @autoreleasepool {
        // https://sekiro.iinti.cn/business/invoke?group=test-objective-c&action=testAction
        SekiroClient *client = [[SekiroClient alloc] init:@"test-objective-c"];
        [client registerAction:@"testAction" handler: test];
        [client registerAction:@"blokingActivon" handler:blokingTest];
        [client start];
        
        // sekiro启动后，运行在新的线程中，所以这里需要sleep一下，否则直接程序就结束了
        [NSThread sleepForTimeInterval:300];
    }
    return 0;
}
